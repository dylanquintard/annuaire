import { ArrowLeft, Link2, Plus, Trash2, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";

type Person = {
  id: string;
  firstName: string;
  lastName: string;
  relationsFrom?: any[];
  relationsTo?: any[];
  memberships?: any[];
};
type Request = (path: string, options?: RequestInit) => Promise<any>;

export function MemberConnections({
  member,
  people,
  request,
  onChanged,
  onOpenPerson,
  onBack,
}: {
  member: Person;
  people: Person[];
  request: Request;
  onChanged: () => Promise<void>;
  onOpenPerson: (person: Person) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [otherId, setOtherId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [relation, setRelation] = useState("");
  const [error, setError] = useState("");
  const links = useMemo(
    () => [
      ...(member.relationsFrom || []).map((r) => ({
        id: r.id,
        person: r.memberB,
        label: r.relationAtoB,
        reciprocal: r.relationBtoA,
      })),
      ...(member.relationsTo || []).map((r) => ({
        id: r.id,
        person: r.memberA,
        label: r.relationBtoA,
        reciprocal: r.relationAtoB,
      })),
    ],
    [member],
  );
  const available = people.filter(
    (p) => p.id !== member.id && !links.some((l) => l.person.id === p.id),
  );
  const addLink = async () => {
    try {
      await request(`/members/${member.id}/relationships`, {
        method: "POST",
        body: JSON.stringify({
          otherMemberId: mode === "existing" ? otherId : undefined,
          newPerson: mode === "new" ? { firstName, lastName } : undefined,
          relation,
        }),
      });
      setOtherId("");
      setFirstName("");
      setLastName("");
      setRelation("");
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const removeLink = async (id: string) => {
    await request(`/members/${member.id}/relationships/${id}`, {
      method: "DELETE",
    });
    await onChanged();
  };
  return (
    <div className="connections wide">
      <div className="connections-toolbar">
        <button className="back-button" onClick={onBack}><ArrowLeft /> Retour à la fiche</button>
        <span>Gestion des liaisons</span>
      </div>
      <section>
        <div className="connection-title">
          <div>
            <Link2 />
            <h3>Personnes liées</h3>
          </div>
        </div>
        {links.length > 0 ? (
          <div className="connection-list">
            {links.map((link) => (
              <div key={link.id}>
                <div>
                  <button
                    className="linked-person"
                    onClick={() => onOpenPerson(link.person)}
                  >
                    {link.person.firstName} {link.person.lastName}
                  </button>
                  <span>{link.label}</span>
                </div>
                <button
                  className="icon danger"
                  onClick={() => void removeLink(link.id)}
                >
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">Aucune personne liée.</p>
        )}
        <div className="connection-form">
          <div className="mode-tabs">
            <button
              className={mode === "existing" ? "active" : ""}
              onClick={() => setMode("existing")}
            >
              Fiche existante
            </button>
            <button
              className={mode === "new" ? "active" : ""}
              onClick={() => setMode("new")}
            >
              <UserPlus /> Nouvelle personne
            </button>
          </div>
          {mode === "existing" ? (
            <label>
              Personne
              <select
                value={otherId}
                onChange={(e) => setOtherId(e.target.value)}
              >
                <option value="">Sélectionner…</option>
                {available.map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.firstName} {p.lastName}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="inline-fields">
              <label>
                Prénom
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </label>
              <label>
                Nom
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </label>
            </div>
          )}
          <label>
            Nature du lien
            <input
              placeholder="Ex. famille, associé, contact…"
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
            />
          </label>
          <button
            className="secondary"
            disabled={
              (!otherId && mode === "existing") ||
              (!firstName && mode === "new") ||
              !relation
            }
            onClick={() => void addLink()}
          >
            <Plus /> Ajouter
          </button>
        </div>
      </section>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
