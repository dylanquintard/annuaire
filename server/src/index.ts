import express, { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';

const db = new PrismaClient();
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '30mb' }));
const loginLimiter=rateLimit({windowMs:15*60*1000,limit:10,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Trop de tentatives. Réessayez dans quelques minutes.'}});
const secret = process.env.JWT_SECRET || '';
if (secret.length < 32) throw new Error('JWT_SECRET doit contenir au moins 32 caractères');

type AuthedRequest = Request & { accountId?: string };
const asyncRoute = (fn: (req: AuthedRequest, res: Response) => Promise<unknown>) =>
  (req: AuthedRequest, res: Response, next: NextFunction) => void fn(req, res).catch(next);
const auth = (req: AuthedRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace(/^Bearer /, '');
    if (!token) return res.status(401).json({ error: 'Connexion requise' });
    req.accountId = (jwt.verify(token, secret) as { sub: string }).sub;
    next();
  } catch { res.status(401).json({ error: 'Session invalide' }); }
};

const credentials = z.object({ username: z.string().trim().min(3).max(30), password: z.string().min(10).max(100) });
const memberInput = z.object({ firstName:z.string().trim().min(1), lastName:z.string().trim().min(1), alias:z.string().optional().default(''), rank:z.string().trim(), phone:z.string().optional().default(''), notes:z.string().optional().default(''), mapX:z.number().min(0).max(1).nullable().optional(), mapY:z.number().min(0).max(1).nullable().optional() });
const caseInput = z.object({ title:z.string().trim().min(2), status:z.enum(['OUVERTE','EN COURS','CLASSÉE']), description:z.string().default(''), suspects:z.string().default(''), evidence:z.string().default('') });
const imageInput = z.object({ name:z.string().max(200), dataUrl:z.string().startsWith('data:image/').max(6_000_000) });
const reportInput = z.object({
  title:z.string().trim().min(2).max(150),
  reportDate:z.coerce.date(),
  details:z.string().max(20_000).default(''),
  images:z.array(imageInput).max(12).default([]),
  sections:z.array(z.object({ id:z.string().optional(), title:z.string().trim().min(1).max(150), description:z.string().max(20_000).default(''), images:z.array(imageInput).max(8).default([]) })).max(50).default([])
});
const relationshipInput = z.object({
  otherMemberId:z.string().optional(),
  newPerson:z.object({firstName:z.string().trim().min(1),lastName:z.string().trim().default('')}).optional(),
  relation:z.string().trim().min(1).max(80),
  reciprocalRelation:z.string().trim().min(1).max(80).optional()
}).refine(value=>value.otherMemberId||value.newPerson,{message:'Choisissez ou créez une personne'});
const groupInput = z.object({name:z.string().trim().min(2).max(120),alias:z.string().default(''),activity:z.string().default(''),phone:z.string().default(''),notes:z.string().default(''),mapX:z.number().min(0).max(1).nullable().optional(),mapY:z.number().min(0).max(1).nullable().optional()});
const membershipInput = z.object({memberId:z.string(),role:z.string().max(100).default('')});

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.post('/api/auth/login', loginLimiter, asyncRoute(async (req, res) => {
  const input = credentials.parse(req.body);
  const account = await db.account.findUnique({ where: { username: input.username.toLowerCase() } });
  if (!account || !await bcrypt.compare(input.password, account.passwordHash)) return res.status(401).json({ error: 'Identifiants incorrects' });
  res.json({ token: jwt.sign({}, secret, { subject: account.id, expiresIn: '12h' }), username: account.username });
}));
app.post('/api/auth/register', loginLimiter, asyncRoute(async (req, res) => {
  const input = credentials.parse(req.body);
  const account = await db.account.create({ data: { username: input.username.toLowerCase(), passwordHash: await bcrypt.hash(input.password, 12) }, select: { id:true, username:true, createdAt:true } });
  res.status(201).json(account);
}));

app.get('/api/members', auth, asyncRoute(async (req,res) => res.json(await db.member.findMany({ where:{accountId:req.accountId}, include:{memberships:{include:{group:true}},relationsFrom:{include:{memberB:true}},relationsTo:{include:{memberA:true}}}, orderBy:[{lastName:'asc'},{firstName:'asc'}] }))));
app.post('/api/members', auth, asyncRoute(async (req,res) => res.status(201).json(await db.member.create({data:{...memberInput.parse(req.body),accountId:req.accountId!}}))));
app.put('/api/members/:id', auth, asyncRoute(async (req,res) => {
  const found=await db.member.findFirst({where:{id:String(req.params.id),accountId:req.accountId}}); if(!found) return res.status(404).json({error:'Introuvable'});
  res.json(await db.member.update({where:{id:found.id},data:memberInput.parse(req.body)}));
}));
app.delete('/api/members/:id', auth, asyncRoute(async (req,res) => { const result=await db.member.deleteMany({where:{id:String(req.params.id),accountId:req.accountId}}); if(!result.count)return res.status(404).json({error:'Introuvable'}); res.status(204).end(); }));

app.post('/api/members/:id/relationships', auth, asyncRoute(async (req,res) => {
  const current=await db.member.findFirst({where:{id:String(req.params.id),accountId:req.accountId}}); if(!current)return res.status(404).json({error:'Fiche introuvable'});
  const input=relationshipInput.parse(req.body); let other;
  if(input.otherMemberId) other=await db.member.findFirst({where:{id:input.otherMemberId,accountId:req.accountId}});
  else other=await db.member.create({data:{accountId:req.accountId!,firstName:input.newPerson!.firstName,lastName:input.newPerson!.lastName,rank:'',alias:'',phone:'',notes:''}});
  if(!other)return res.status(404).json({error:'Personne liée introuvable'}); if(other.id===current.id)return res.status(400).json({error:'Une fiche ne peut pas être liée à elle-même'});
  const currentIsA=current.id<other.id; const memberAId=currentIsA?current.id:other.id; const memberBId=currentIsA?other.id:current.id; const sharedRelation=input.relation;
  const relationship=await db.relationship.upsert({where:{accountId_memberAId_memberBId:{accountId:req.accountId!,memberAId,memberBId}},create:{accountId:req.accountId!,memberAId,memberBId,relationAtoB:sharedRelation,relationBtoA:sharedRelation},update:{relationAtoB:sharedRelation,relationBtoA:sharedRelation}});
  res.status(201).json(relationship);
}));
app.delete('/api/members/:id/relationships/:relationshipId', auth, asyncRoute(async (req,res) => {const result=await db.relationship.deleteMany({where:{id:String(req.params.relationshipId),accountId:req.accountId,OR:[{memberAId:String(req.params.id)},{memberBId:String(req.params.id)}]}});if(!result.count)return res.status(404).json({error:'Lien introuvable'});res.status(204).end()}));

app.get('/api/groups', auth, asyncRoute(async (req,res)=>res.json(await db.rPGroup.findMany({where:{accountId:req.accountId,kind:'GROUP'},include:{memberships:{include:{member:true},orderBy:{createdAt:'asc'}}},orderBy:{name:'asc'}}))));
app.post('/api/groups', auth, asyncRoute(async (req,res)=>res.status(201).json(await db.rPGroup.create({data:{...groupInput.parse(req.body),kind:'GROUP',accountId:req.accountId!}}))));
app.put('/api/groups/:id', auth, asyncRoute(async (req,res)=>{const group=await db.rPGroup.findFirst({where:{id:String(req.params.id),accountId:req.accountId,kind:'GROUP'}});if(!group)return res.status(404).json({error:'Groupe introuvable'});res.json(await db.rPGroup.update({where:{id:group.id},data:groupInput.parse(req.body)}))}));
app.delete('/api/groups/:id', auth, asyncRoute(async (req,res)=>{const result=await db.rPGroup.deleteMany({where:{id:String(req.params.id),accountId:req.accountId,kind:'GROUP'}});if(!result.count)return res.status(404).json({error:'Groupe introuvable'});res.status(204).end()}));
app.post('/api/groups/:id/members', auth, asyncRoute(async (req,res)=>{const input=membershipInput.parse(req.body);const [group,member]=await Promise.all([db.rPGroup.findFirst({where:{id:String(req.params.id),accountId:req.accountId,kind:'GROUP'}}),db.member.findFirst({where:{id:input.memberId,accountId:req.accountId}})]);if(!group||!member)return res.status(404).json({error:'Groupe ou membre introuvable'});await db.groupMembership.deleteMany({where:{memberId:member.id,groupId:{not:group.id}}});res.status(201).json(await db.groupMembership.upsert({where:{memberId_groupId:{memberId:member.id,groupId:group.id}},create:{memberId:member.id,groupId:group.id,role:input.role},update:{role:input.role}}))}));
app.delete('/api/groups/:id/members/:memberId', auth, asyncRoute(async (req,res)=>{const group=await db.rPGroup.findFirst({where:{id:String(req.params.id),accountId:req.accountId}});if(!group)return res.status(404).json({error:'Groupe introuvable'});const result=await db.groupMembership.deleteMany({where:{groupId:group.id,memberId:String(req.params.memberId)}});if(!result.count)return res.status(404).json({error:'Appartenance introuvable'});res.status(204).end()}));

app.get('/api/enterprises', auth, asyncRoute(async (req,res)=>res.json(await db.rPGroup.findMany({where:{accountId:req.accountId,kind:'ENTERPRISE'},include:{memberships:{include:{member:true},orderBy:{createdAt:'asc'}}},orderBy:{name:'asc'}}))));
app.post('/api/enterprises', auth, asyncRoute(async (req,res)=>res.status(201).json(await db.rPGroup.create({data:{...groupInput.parse(req.body),kind:'ENTERPRISE',accountId:req.accountId!}}))));
app.put('/api/enterprises/:id', auth, asyncRoute(async (req,res)=>{const item=await db.rPGroup.findFirst({where:{id:String(req.params.id),accountId:req.accountId,kind:'ENTERPRISE'}});if(!item)return res.status(404).json({error:'Entreprise introuvable'});res.json(await db.rPGroup.update({where:{id:item.id},data:groupInput.parse(req.body)}))}));
app.delete('/api/enterprises/:id', auth, asyncRoute(async (req,res)=>{const result=await db.rPGroup.deleteMany({where:{id:String(req.params.id),accountId:req.accountId,kind:'ENTERPRISE'}});if(!result.count)return res.status(404).json({error:'Entreprise introuvable'});res.status(204).end()}));
app.post('/api/enterprises/:id/members', auth, asyncRoute(async (req,res)=>{const input=membershipInput.parse(req.body);const [item,member]=await Promise.all([db.rPGroup.findFirst({where:{id:String(req.params.id),accountId:req.accountId,kind:'ENTERPRISE'}}),db.member.findFirst({where:{id:input.memberId,accountId:req.accountId}})]);if(!item||!member)return res.status(404).json({error:'Entreprise ou membre introuvable'});await db.groupMembership.deleteMany({where:{memberId:member.id,groupId:{not:item.id}}});res.status(201).json(await db.groupMembership.upsert({where:{memberId_groupId:{memberId:member.id,groupId:item.id}},create:{memberId:member.id,groupId:item.id,role:input.role},update:{role:input.role}}))}));
app.delete('/api/enterprises/:id/members/:memberId', auth, asyncRoute(async (req,res)=>{const item=await db.rPGroup.findFirst({where:{id:String(req.params.id),accountId:req.accountId,kind:'ENTERPRISE'}});if(!item)return res.status(404).json({error:'Entreprise introuvable'});const result=await db.groupMembership.deleteMany({where:{groupId:item.id,memberId:String(req.params.memberId)}});if(!result.count)return res.status(404).json({error:'Appartenance introuvable'});res.status(204).end()}));

app.put('/api/members/:id/affiliation', auth, asyncRoute(async (req,res)=>{const input=z.object({organizationId:z.string().nullable(),status:z.enum(['CIVIL','INDEPENDENT'])}).parse(req.body);const member=await db.member.findFirst({where:{id:String(req.params.id),accountId:req.accountId},include:{memberships:true}});if(!member)return res.status(404).json({error:'Fiche introuvable'});if(input.organizationId){const organization=await db.rPGroup.findFirst({where:{id:input.organizationId,accountId:req.accountId}});if(!organization)return res.status(404).json({error:'Organisation introuvable'});const existing=member.memberships.find(m=>m.groupId===organization.id);await db.groupMembership.deleteMany({where:{memberId:member.id,...(existing?{groupId:{not:organization.id}}:{})}});if(!existing)await db.groupMembership.create({data:{memberId:member.id,groupId:organization.id,role:''}});await db.member.update({where:{id:member.id},data:{rank:''}})}else{await db.groupMembership.deleteMany({where:{memberId:member.id}});await db.member.update({where:{id:member.id},data:{rank:input.status==='INDEPENDENT'?'Indépendant':'Civil'}})}res.json({ok:true})}));

app.get('/api/investigations', auth, asyncRoute(async (req,res) => res.json(await db.investigation.findMany({where:{accountId:req.accountId},orderBy:{updatedAt:'desc'}}))));
app.post('/api/investigations', auth, asyncRoute(async (req,res) => res.status(201).json(await db.investigation.create({data:{...caseInput.parse(req.body),accountId:req.accountId!}}))));
app.put('/api/investigations/:id', auth, asyncRoute(async (req,res) => { const found=await db.investigation.findFirst({where:{id:String(req.params.id),accountId:req.accountId}}); if(!found)return res.status(404).json({error:'Introuvable'}); res.json(await db.investigation.update({where:{id:found.id},data:caseInput.parse(req.body)})); }));
app.delete('/api/investigations/:id', auth, asyncRoute(async (req,res) => { const result=await db.investigation.deleteMany({where:{id:String(req.params.id),accountId:req.accountId}}); if(!result.count)return res.status(404).json({error:'Introuvable'}); res.status(204).end(); }));

app.get('/api/investigations/:id/reports', auth, asyncRoute(async (req,res) => {
  const investigation=await db.investigation.findFirst({where:{id:String(req.params.id),accountId:req.accountId}});
  if(!investigation)return res.status(404).json({error:'Dossier introuvable'});
  res.json(await db.report.findMany({where:{investigationId:investigation.id},orderBy:[{reportDate:'desc'},{createdAt:'desc'}]}));
}));
app.post('/api/investigations/:id/reports', auth, asyncRoute(async (req,res) => {
  const investigation=await db.investigation.findFirst({where:{id:String(req.params.id),accountId:req.accountId}});
  if(!investigation)return res.status(404).json({error:'Dossier introuvable'});
  const input=reportInput.parse(req.body); const {images,sections,...fields}=input;
  const report=await db.report.create({data:{...fields,investigationId:investigation.id,content:{images,sections} as Prisma.InputJsonValue}});
  await db.investigation.update({where:{id:investigation.id},data:{updatedAt:new Date()}});
  res.status(201).json(report);
}));
app.put('/api/investigations/:id/reports/:reportId', auth, asyncRoute(async (req,res) => {
  const report=await db.report.findFirst({where:{id:String(req.params.reportId),investigation:{id:String(req.params.id),accountId:req.accountId}}});
  if(!report)return res.status(404).json({error:'Rapport introuvable'});
  const input=reportInput.parse(req.body); const {images,sections,...fields}=input;
  const updated=await db.report.update({where:{id:report.id},data:{...fields,content:{images,sections} as Prisma.InputJsonValue}});
  await db.investigation.update({where:{id:report.investigationId},data:{updatedAt:new Date()}});
  res.json(updated);
}));
app.delete('/api/investigations/:id/reports/:reportId', auth, asyncRoute(async (req,res) => {
  const result=await db.report.deleteMany({where:{id:String(req.params.reportId),investigation:{id:String(req.params.id),accountId:req.accountId}}});
  if(!result.count)return res.status(404).json({error:'Rapport introuvable'}); res.status(204).end();
}));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof z.ZodError) return res.status(400).json({ error: 'Données invalides', details: err.flatten() });
  if ((err as {code?:string}).code === 'P2002') return res.status(409).json({ error: 'Cet identifiant existe déjà' });
  console.error(err); res.status(500).json({ error: 'Erreur interne' });
});

async function start() {
  const username=process.env.INITIAL_USERNAME?.toLowerCase(); const password=process.env.INITIAL_PASSWORD;
  if(username && password && !await db.account.findUnique({where:{username}})) await db.account.create({data:{username,passwordHash:await bcrypt.hash(password,12)}});
  app.listen(Number(process.env.PORT)||3001,()=>console.log('API prête'));
}
start();
