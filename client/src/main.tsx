import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookUser,
  BadgeCheck,
  Building2,
  BriefcaseBusiness,
  ClipboardList,
  LogOut,
  Link2,
  Plus,
  Save,
  Search,
  Shield,
  Trash2,
  UsersRound,
  X,
} from "lucide-react";
import "./style.css";
import { MapPicker } from "./MapPicker";
import { InvestigationView } from "./InvestigationView";
import { MemberConnections } from "./MemberConnections";
import { GroupsView, type RPGroup } from "./GroupsView";

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  alias: string;
  rank: string;
  phone: string;
  notes: string;
  mapX: number | null;
  mapY: number | null;
  memberships?: any[];
  relationsFrom?: any[];
  relationsTo?: any[];
};
type Case = {
  id: string;
  title: string;
  status: "OUVERTE" | "EN COURS" | "CLASSÉE";
  description: string;
  suspects: string;
  evidence: string;
  updatedAt: string;
};
type CaseForm = Pick<
  Case,
  "title" | "status" | "description" | "suspects" | "evidence"
>;
const emptyMember = {
  firstName: "",
  lastName: "",
  alias: "",
  rank: "",
  phone: "",
  notes: "",
  mapX: null as number | null,
  mapY: null as number | null,
};
const emptyCase: CaseForm = {
  title: "",
  status: "OUVERTE",
  description: "",
  suspects: "",
  evidence: "",
};

function App() {
  const applicationBase = import.meta.env.BASE_URL.replace(/\/$/, "");
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [username, setUsername] = useState(
    localStorage.getItem("username") || "",
  );
  const [tab, setTab] = useState<"directory" | "groups" | "enterprises" | "cases">("directory");
  const [members, setMembers] = useState<Member[]>([]);
  const [groups, setGroups] = useState<RPGroup[]>([]);
  const [enterprises, setEnterprises] = useState<RPGroup[]>([]);
  const [affiliationChoice, setAffiliationChoice] = useState("civil");
  const [directoryFilter, setDirectoryFilter] = useState<"incomplete"|"complete"|"all">("all");
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [modal, setModal] = useState<"member" | "case" | null>(
    null,
  );
  const [editing, setEditing] = useState<string>();
  const [error, setError] = useState("");
  const [member, setMember] = useState(emptyMember);
  const [showConnections, setShowConnections] = useState(false);
  const [caseForm, setCaseForm] = useState(emptyCase);
  const [registerMode, setRegisterMode] = useState(false);
  async function api(path: string, options: RequestInit = {}) {
    const r = await fetch(applicationBase + "/api" + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (r.status === 204) return null;
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Une erreur est survenue");
    return data;
  }
  async function load() {
    try {
      const [m, c, g, e] = await Promise.all([
        api("/members"),
        api("/investigations"),
        api("/groups"),
        api("/enterprises"),
      ]);
      setMembers(m);
      setCases(c);
      setGroups(g);
      setEnterprises(e);
    } catch (e) {
      if ((e as Error).message.includes("Session")) logout();
    }
  }
  useEffect(() => {
    if (token) void load();
  }, [token]);
  function logout() {
    localStorage.clear();
    setToken("");
    setUsername("");
  }
  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      const d = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: fd.get("username"),
          password: fd.get("password"),
        }),
      });
      localStorage.setItem("token", d.token);
      localStorage.setItem("username", d.username);
      setUsername(d.username);
      setToken(d.token);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function register(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") || "");
    if (password !== String(fd.get("confirmPassword") || "")) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    try {
      await api("/auth/register", { method: "POST", body: JSON.stringify({ username: fd.get("username"), password }) });
      setRegisterMode(false);
      alert("Compte créé. Vous pouvez maintenant vous connecter.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function openMember(m?: Member) {
    setShowConnections(false);
    setEditing(m?.id);
    setMember(
      m
        ? {
            firstName: m.firstName,
            lastName: m.lastName,
            alias: m.alias || "",
            rank: m.rank,
            phone: m.phone || "",
            notes: m.notes || "",
            mapX: m.mapX,
            mapY: m.mapY,
          }
        : emptyMember,
    );
    setAffiliationChoice(m?.memberships?.[0]?.group?.id ? `org:${m.memberships[0].group.id}` : m?.rank === "Indépendant" ? "independent" : "civil");
    setModal("member");
    setError("");
  }
  function openCase(c?: Case) {
    setEditing(c?.id);
    setCaseForm(
      c
        ? {
            title: c.title,
            status: c.status,
            description: c.description,
            suspects: c.suspects,
            evidence: c.evidence,
          }
        : emptyCase,
    );
    setModal("case");
    setError("");
  }
  async function save(kind: "member" | "case") {
    try {
      const isMember = kind === "member",
        path = isMember ? "/members" : "/investigations",
        body = isMember ? {...member,rank:affiliationChoice==="independent"?"Indépendant":affiliationChoice==="civil"?"Civil":""} : caseForm;
      const saved = await api(path + (editing ? `/${editing}` : ""), {
        method: editing ? "PUT" : "POST",
        body: JSON.stringify(body),
      });
      if (isMember) await api(`/members/${saved.id}/affiliation`,{method:"PUT",body:JSON.stringify({organizationId:affiliationChoice.startsWith("org:")?affiliationChoice.slice(4):null,status:affiliationChoice==="independent"?"INDEPENDENT":"CIVIL"})});
      if (kind === "case" && selectedCase?.id === editing) {
        setSelectedCase((current) =>
          current && current.id === editing
            ? { ...current, ...caseForm }
            : current,
        );
      }
      setModal(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function remove(kind: "member" | "case", id: string) {
    if (!confirm("Supprimer définitivement cet élément ?")) return;
    await api((kind === "member" ? "/members/" : "/investigations/") + id, {
      method: "DELETE",
    });
    await load();
  }
  const normalizedSearch = memberSearch.trim().toLocaleLowerCase("fr");
  const visibleMembers = normalizedSearch
    ? members.filter((m) =>
        [m.firstName, m.lastName, m.alias, m.phone, m.rank, ...(m.memberships||[]).flatMap((membership:any)=>[membership.group.name,membership.role])].some((value) =>
          value?.toLocaleLowerCase("fr").includes(normalizedSearch),
        ),
      )
    : members;
  const affiliationLabel = (person:Member) => person.memberships?.[0] ? `${person.memberships[0].group.name}${person.memberships[0].role ? ` · ${person.memberships[0].role}` : ""}` : person.rank || "Situation non renseignée";
  const isComplete = (member: Member) => Boolean(member.firstName.trim() && member.lastName.trim() && (member.rank.trim() || member.memberships?.length) && member.phone?.trim() && member.mapX !== null && member.mapY !== null);
  const displayedMembers = visibleMembers.filter(member => directoryFilter === "all" || (directoryFilter === "complete" ? isComplete(member) : !isComplete(member)));
  const completeCount = members.filter(isComplete).length;
  const sortedCases = [...cases].sort((a, b) => {
    const order: Record<Case["status"], number> = { "EN COURS": 0, OUVERTE: 1, CLASSÉE: 2 };
    return order[a.status] - order[b.status] || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
  if (!token)
    return (
      <main className="login">
        <section className="login-card">
          <div className="crest">
            <Shield size={36} />
          </div>
          <p className="eyebrow">Accès confidentiel</p>
          <h1>
          Annuaire <span>interne</span>
          </h1>
          <p className="muted">{registerMode ? "Créez votre espace personnel sécurisé." : "Identifiez-vous pour accéder aux dossiers."}</p>
          <form onSubmit={registerMode ? register : login}>
            <label>
              Identifiant
              <input
                name="username"
                autoComplete={registerMode ? "new-username" : "username"}
                required
                autoFocus
              />
            </label>
            <label>
              Mot de passe
              <input
                name="password"
                type="password"
                autoComplete={registerMode ? "new-password" : "current-password"}
                required
                minLength={registerMode ? 10 : undefined}
              />
            </label>
            {registerMode && <label>
              Confirmer le mot de passe
              <input name="confirmPassword" type="password" autoComplete="new-password" required minLength={10}/>
            </label>}
            {error && <p className="error">{error}</p>}
            <button className="primary">{registerMode ? "Créer mon compte" : "Entrer dans l’espace"}</button>
            <button type="button" className="auth-switch" onClick={()=>{setRegisterMode(!registerMode);setError("")}}>
              {registerMode ? "Déjà un compte ? Se connecter" : "Créer un nouveau compte"}
            </button>
          </form>
        </section>
      </main>
    );
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <Shield />
          <div>
            <small>ESPACE PRIVÉ</small>
            <strong>Annuaire interne</strong>
          </div>
        </div>
        <nav>
          <button
            className={tab === "directory" ? "active" : ""}
            onClick={() => setTab("directory")}
          >
            <BookUser />
            Annuaire
          </button>
          <button
            className={tab === "groups" ? "active" : ""}
            onClick={() => setTab("groups")}
          >
            <UsersRound />
            Groupes
          </button>
          <button className={tab === "enterprises" ? "active" : ""} onClick={() => setTab("enterprises")}>
            <Building2 />
            Entreprises
          </button>
          <div className="nav-separator"><span>Dossiers</span></div>
          <button
            className={tab === "cases" ? "active" : ""}
            onClick={() => setTab("cases")}
          >
            <BriefcaseBusiness />
            Enquêtes
          </button>
        </nav>
        <div className="aside-foot">
          <button onClick={logout}>
            <LogOut />
            Déconnexion
          </button>
        </div>
      </aside>
      <main className="content">
        {tab === "cases" && selectedCase ? (
          <InvestigationView
            investigation={selectedCase}
            request={api}
            onBack={() => setSelectedCase(null)}
            onEdit={() => openCase(selectedCase)}
          />
        ) : (
          <>
        <header>
          <div>
            <p className="eyebrow">SESSION · {username.toUpperCase()}</p>
            <h1>
              {tab === "directory"
                ? "Annuaire Civil"
                : tab === "groups" ? "Annuaire des groupes" : tab === "enterprises" ? "Annuaire des entreprises" : "Dossiers d’enquête"}
            </h1>
          </div>
          {tab !== "groups" && tab !== "enterprises" && <button
            className="primary compact"
            onClick={() => (tab === "directory" ? openMember() : openCase())}
          >
            <Plus />{" "}
            {tab === "directory" ? "Nouvelle fiche" : "Nouvelle enquête"}
          </button>}
        </header>
        {tab === "directory" ? (
          <>
            <div className="search">
              <Search />
              <input
                type="search"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Rechercher par nom, prénom, numéro ou emploi / groupe…"
                aria-label="Rechercher dans l’annuaire"
              />
              {memberSearch && (
                <button
                  className="icon"
                  onClick={() => setMemberSearch("")}
                  aria-label="Effacer la recherche"
                >
                  <X />
                </button>
              )}
            </div>
            <div className="directory-filters">
              <button className={directoryFilter==="all"?"active":""} onClick={()=>setDirectoryFilter("all")}><BookUser/> Toutes <span>{members.length}</span></button>
              <button className={directoryFilter==="complete"?"active":""} onClick={()=>setDirectoryFilter("complete")}><BadgeCheck/> Complétées <span>{completeCount}</span></button>
              <button className={directoryFilter==="incomplete"?"active":""} onClick={()=>setDirectoryFilter("incomplete")}><ClipboardList/> À finir <span>{members.length-completeCount}</span></button>
            </div>
            <section className="grid">
              {displayedMembers.map((m) => (
                <article
                  className="card"
                  key={m.id}
                  onClick={() => openMember(m)}
                >
                  <div className="avatar">
                    {m.firstName[0]}
                    {m.lastName[0]}
                  </div>
                  <div className="grow">
                    <span className="tag">{affiliationLabel(m)}</span>
                    <h2>
                      {m.firstName} {m.lastName}
                    </h2>
                    <p>
                      {m.alias ? `« ${m.alias} »` : "Aucun alias"} ·{" "}
                      {m.phone || "Téléphone inconnu"}
                    </p>
                  </div>
                  <button
                    className="icon danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      void remove("member", m.id);
                    }}
                  >
                    <Trash2 />
                  </button>
                </article>
              ))}
              {!members.length ? (
                <Empty text="Aucun membre dans cet annuaire." />
              ) : (
                !displayedMembers.length && (
                  <Empty text={normalizedSearch ? "Aucune personne ne correspond à cette recherche." : directoryFilter === "complete" ? "Aucune fiche complète." : "Aucune fiche à renseigner."} />
                )
              )}
            </section>
          </>
        ) : tab === "groups" ? (
          <GroupsView mode="group" groups={groups} people={members} request={api} onChanged={load} />
        ) : tab === "enterprises" ? (
          <GroupsView mode="enterprise" groups={enterprises} people={members} request={api} onChanged={load} />
        ) : (
          <section className="grid">
            {sortedCases.map((c) => (
              <article
                className={`card case folder-${c.status.replace(" ", "-").toLowerCase()}`}
                key={c.id}
                onClick={() => setSelectedCase(c)}
              >
                <div
                  className={
                    "status " + c.status.replace(" ", "-").toLowerCase()
                  }
                ></div>
                <div className="grow">
                  <span className="tag">{c.status}</span>
                  <h2>{c.title}</h2>
                  <p>{c.description || "Aucune description"} </p>
                  <small>
                    Mis à jour le{" "}
                    {new Date(c.updatedAt).toLocaleDateString("fr-FR")}
                  </small>
                </div>
                <button
                  className="icon danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    void remove("case", c.id);
                  }}
                >
                  <Trash2 />
                </button>
              </article>
            ))}
            {!cases.length && <Empty text="Aucune enquête pour ce compte." />}
          </section>
        )}
          </>
        )}
      </main>
      {modal && (
        <div className="overlay" onMouseDown={() => setModal(null)}>
          <section className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setModal(null)}>
              <X />
            </button>
            <p className="eyebrow">
              {editing ? "MODIFICATION" : "NOUVEAU DOSSIER"}
            </p>
            <h2>
              {modal === "member"
                ? "Fiche de membre"
                : "Dossier d’enquête"}
            </h2>
            {modal === "member" && (
              <div className={`form-grid${showConnections ? " connections-mode" : ""}`}>
                <Field
                  label="Prénom"
                  value={member.firstName}
                  set={(v) => setMember({ ...member, firstName: v })}
                />
                <Field
                  label="Nom"
                  value={member.lastName}
                  set={(v) => setMember({ ...member, lastName: v })}
                />
                <Field
                  label="Alias"
                  value={member.alias}
                  set={(v) => setMember({ ...member, alias: v })}
                />
                <label>
                  Situation / appartenance
                  <select value={affiliationChoice} onChange={(e)=>setAffiliationChoice(e.target.value)}>
                    <option value="civil">Civil</option>
                    <option value="independent">Indépendant</option>
                    <optgroup label="Groupes">
                      {groups.map((group)=><option value={`org:${group.id}`} key={group.id}>{group.name}</option>)}
                    </optgroup>
                    <optgroup label="Entreprises">
                      {enterprises.map((enterprise)=><option value={`org:${enterprise.id}`} key={enterprise.id}>{enterprise.name}</option>)}
                    </optgroup>
                  </select>
                </label>
                <label>
                  Rôle / fonction
                  <input value={editing ? members.find((person)=>person.id===editing)?.memberships?.find((membership:any)=>`org:${membership.group.id}`===affiliationChoice)?.role || "Non renseigné dans la fiche correspondante" : "À définir depuis la fiche du groupe ou de l’entreprise"} readOnly />
                </label>
                <Field
                  label="Téléphone"
                  value={member.phone}
                  set={(v) => setMember({ ...member, phone: v })}
                />
                <Area
                  label="Notes"
                  value={member.notes}
                  set={(v) => setMember({ ...member, notes: v })}
                />
                <button
                  type="button"
                  className="secondary connection-launch wide"
                  disabled={!editing}
                  onClick={() => setShowConnections(true)}
                >
                  <Link2 /> {editing ? "Ajouter ou gérer les liaisons" : "Enregistrez d’abord la fiche pour ajouter une liaison"}
                </button>
                <MapPicker
                  point={
                    member.mapX !== null && member.mapY !== null
                      ? { x: member.mapX, y: member.mapY }
                      : null
                  }
                  onChange={(point) =>
                    setMember({
                      ...member,
                      mapX: point?.x ?? null,
                      mapY: point?.y ?? null,
                    })
                  }
                />
                {showConnections && editing && members.find((person) => person.id === editing) && (
                  <MemberConnections
                    member={members.find((person) => person.id === editing)!}
                    people={members}
                    request={api}
                    onChanged={load}
                    onOpenPerson={(person) => openMember(person as Member)}
                    onBack={() => setShowConnections(false)}
                  />
                )}
              </div>
            )}
            {modal === "case" && (
              <div className="form-grid">
                <Field
                  label="Titre"
                  value={caseForm.title}
                  set={(v) => setCaseForm({ ...caseForm, title: v })}
                />
                <label>
                  Statut
                  <select
                    value={caseForm.status}
                    onChange={(e) =>
                      setCaseForm({
                        ...caseForm,
                        status: e.target.value as Case["status"],
                      })
                    }
                  >
                    <option>OUVERTE</option>
                    <option>EN COURS</option>
                    <option>CLASSÉE</option>
                  </select>
                </label>
                <Area
                  label="Résumé"
                  value={caseForm.description}
                  set={(v) => setCaseForm({ ...caseForm, description: v })}
                />
              </div>
            )}
            {error && <p className="error">{error}</p>}
            {!(modal === "member" && showConnections) && <button
              className="primary"
              onClick={() => void save(modal)}
            >
              <Save /> Enregistrer
            </button>}
          </section>
        </div>
      )}
    </div>
  );
}
function Field({
  label,
  value,
  set,
  password = false,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
  password?: boolean;
}) {
  const displayLabel = label;
  return (
    <label>
      {displayLabel}
      <input
        type={password ? "password" : "text"}
        value={value}
        onChange={(e) => set(e.target.value)}
      />
    </label>
  );
}
function Area({
  label,
  value,
  set,
}: {
  label: string;
  value: string;
  set: (v: string) => void;
}) {
  return (
    <label className="wide">
      {label}
      <textarea rows={4} value={value} onChange={(e) => set(e.target.value)} />
    </label>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="empty">
      <Shield />
      <p>{text}</p>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
