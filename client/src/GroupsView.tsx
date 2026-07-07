import { Plus, Save, Trash2, UserPlus, UsersRound, X } from "lucide-react";
import { useState } from "react";
import { MapPicker } from "./MapPicker";

export type RPGroup = {
  id: string;
  name: string;
  alias: string;
  activity: string;
  phone: string;
  notes: string;
  mapX: number | null;
  mapY: number | null;
  memberships: {
    id: string;
    role: string;
    member: { id: string; firstName: string; lastName: string };
  }[];
};
type Person = { id: string; firstName: string; lastName: string };
type Request = (path: string, options?: RequestInit) => Promise<any>;
const empty = {
  name: "",
  alias: "",
  activity: "",
  phone: "",
  notes: "",
  mapX: null as number | null,
  mapY: null as number | null,
};
export function GroupsView({
  groups,
  people,
  request,
  onChanged,
  mode,
}: {
  groups: RPGroup[];
  people: Person[];
  request: Request;
  onChanged: () => Promise<void>;
  mode: "group" | "enterprise";
}) {
  const enterprise = mode === "enterprise";
  const basePath = enterprise ? "/enterprises" : "/groups";
  const [open, setOpen] = useState<RPGroup | null | "new">(null);
  const [form, setForm] = useState(empty);
  const [memberId, setMemberId] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const edit = (group?: RPGroup) => {
    setOpen(group || "new");
    setForm(
      group
        ? {
            name: group.name,
            alias: group.alias || "",
            activity: group.activity || "",
            phone: group.phone || "",
            notes: group.notes || "",
            mapX: group.mapX,
            mapY: group.mapY,
          }
        : empty,
    );
    setError("");
  };
  const current =
    open && open !== "new"
      ? groups.find((g) => g.id === open.id) || open
      : null;
  const save = async () => {
    try {
      await request(`${basePath}${current ? `/${current.id}` : ""}`, {
        method: current ? "PUT" : "POST",
        body: JSON.stringify(form),
      });
      setOpen(null);
      await onChanged();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const remove = async (group: RPGroup) => {
    if (!confirm(`Supprimer ${enterprise ? "l’entreprise" : "le groupe"} ${group.name} ?`)) return;
    await request(`${basePath}/${group.id}`, { method: "DELETE" });
    await onChanged();
  };
  const addMember = async () => {
    if (!current) return;
    await request(`${basePath}/${current.id}/members`, {
      method: "POST",
      body: JSON.stringify({ memberId, role }),
    });
    setMemberId("");
    setRole("");
    await onChanged();
  };
  const removeMember = async (id: string) => {
    if (!current) return;
    await request(`${basePath}/${current.id}/members/${id}`, { method: "DELETE" });
    await onChanged();
  };
  const updateRole = async (memberId: string, nextRole: string) => {
    if (!current) return;
    await request(`${basePath}/${current.id}/members`, {
      method: "POST",
      body: JSON.stringify({ memberId, role: nextRole }),
    });
    await onChanged();
  };
  return (
    <>
      <div className="groups-toolbar">
        <p>{enterprise ? "Répertoire des entreprises et de leurs salariés." : "Répertoire des groupes et de leurs membres."}</p>
        <button className="primary" onClick={() => edit()}>
          <Plus /> {enterprise ? "Nouvelle entreprise" : "Nouveau groupe"}
        </button>
      </div>
      <section className="grid">
        {groups.map((g) => (
          <article
            className="card group-card"
            key={g.id}
            onClick={() => edit(g)}
          >
            <div className="group-avatar">
              <UsersRound />
            </div>
            <div className="grow">
              <span className="tag">{g.activity || "ACTIVITÉ INCONNUE"}</span>
              <h2>{g.name}</h2>
              <p>
                {g.alias || "Aucun nom d’usage"} · {g.memberships.length} {enterprise ? "salarié" : "membre"}
                {g.memberships.length > 1 ? "s" : ""}
              </p>
            </div>
            <button
              className="icon danger"
              onClick={(e) => {
                e.stopPropagation();
                void remove(g);
              }}
            >
              <Trash2 />
            </button>
          </article>
        ))}
        {!groups.length && (
          <div className="empty">
            <UsersRound />
            <p>{enterprise ? "Aucune entreprise renseignée." : "Aucun groupe renseigné."}</p>
          </div>
        )}
      </section>
      {open && (
        <div className="overlay" onMouseDown={() => setOpen(null)}>
          <section
            className="modal group-editor"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button className="close" onClick={() => setOpen(null)}>
              <X />
            </button>
            <p className="eyebrow">
              {current ? (enterprise ? "MODIFIER L’ENTREPRISE" : "MODIFIER LE GROUPE") : (enterprise ? "NOUVELLE ENTREPRISE" : "NOUVEAU GROUPE")}
            </p>
            <h2>{enterprise ? "Fiche d’entreprise" : "Fiche de groupe"}</h2>
            <div className="form-grid">
              <label>
                Nom
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label>
                Nom d’usage
                <input
                  value={form.alias}
                  onChange={(e) => setForm({ ...form, alias: e.target.value })}
                />
              </label>
              <label>
                Activité
                <input
                  value={form.activity}
                  onChange={(e) =>
                    setForm({ ...form, activity: e.target.value })
                  }
                />
              </label>
              <label>
                Téléphone
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </label>
              <label className="wide">
                Notes
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </label>
              <MapPicker
                point={
                  form.mapX !== null && form.mapY !== null
                    ? { x: form.mapX, y: form.mapY }
                    : null
                }
                onChange={(p) =>
                  setForm({ ...form, mapX: p?.x ?? null, mapY: p?.y ?? null })
                }
              />
            </div>
            {current && (
              <section className="group-members">
                <h3>{enterprise ? "Salariés de l’entreprise" : "Membres du groupe"}</h3>
                {current.memberships.map((m) => (
                  <div className="group-member" key={m.id}>
                    <div>
                      <strong>
                        {m.member.firstName} {m.member.lastName}
                      </strong>
                      <input
                        className="member-role-input"
                        defaultValue={m.role}
                        placeholder={enterprise ? "Fonction" : "Rôle"}
                        onBlur={(event) => {
                          if (event.target.value !== m.role)
                            void updateRole(m.member.id, event.target.value);
                        }}
                      />
                    </div>
                    <button
                      className="icon danger"
                      onClick={() => void removeMember(m.member.id)}
                    >
                      <Trash2 />
                    </button>
                  </div>
                ))}
                <div className="inline-fields">
                  <label>
                    Ajouter une fiche
                    <select
                      value={memberId}
                      onChange={(e) => setMemberId(e.target.value)}
                    >
                      <option value="">Sélectionner…</option>
                      {people
                        .filter(
                          (p) =>
                            !current.memberships.some(
                              (m) => m.member.id === p.id,
                            ),
                        )
                        .map((p) => (
                          <option value={p.id} key={p.id}>
                            {p.firstName} {p.lastName}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Rôle
                    <input
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    />
                  </label>
                  <button
                    className="secondary"
                    disabled={!memberId}
                    onClick={() => void addMember()}
                  >
                    <UserPlus /> Lier
                  </button>
                </div>
              </section>
            )}
            {error && <p className="error">{error}</p>}
            <button
              className="primary"
              disabled={!form.name.trim()}
              onClick={() => void save()}
            >
              <Save /> Enregistrer
            </button>
          </section>
        </div>
      )}
    </>
  );
}
