"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EVENT_KINDS, REMIND_OPTIONS, type StudioEvent } from "@/lib/domain";
import { TextField, SelectField, TextAreaField, SubmitButton, FormError, FieldLabel } from "@/components/fields";

/**
 * Create and edit surface for calendar events. Picking a project with no
 * client chosen fills the client in; switching clients drops a project that
 * no longer belongs to it. Duration is a select, not a raw end time, because
 * nobody schedules a call for "16:47".
 */

const dateTimeInputClass =
  "mt-2 w-full border-b border-line bg-transparent pb-2 text-fluid-base outline-none transition-colors focus:border-fg placeholder:text-muted/60";

const DURATION_OPTIONS = [
  { value: "30", label: "30 minutes" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "Hour" },
  { value: "90", label: "90 minutes" },
  { value: "120", label: "2 hours" },
  { value: "", label: "No end time" },
] as const;

const DURATION_MINUTES = [30, 45, 60, 90, 120];

function localDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA").format(d);
}

function localTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function nearestDuration(minutes: number): string {
  let best = DURATION_MINUTES[0];
  for (const m of DURATION_MINUTES) {
    if (Math.abs(m - minutes) < Math.abs(best - minutes)) best = m;
  }
  return String(best);
}

type EventFormProps = {
  clients: { id: string; name: string }[];
  projects: { id: string; name: string; client_id: string }[];
  initial?: StudioEvent;
  defaultClientId?: string | null;
  defaultProjectId?: string | null;
};

export default function EventForm({ clients, projects, initial, defaultClientId, defaultProjectId }: EventFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [kind, setKind] = useState(initial?.kind ?? EVENT_KINDS[0].value);
  const [clientId, setClientId] = useState(initial?.client_id ?? defaultClientId ?? "");
  const [projectId, setProjectId] = useState(initial?.project_id ?? defaultProjectId ?? "");
  const [date, setDate] = useState(() => (initial ? localDate(new Date(initial.starts_at)) : ""));
  const [time, setTime] = useState(() => (initial ? localTime(new Date(initial.starts_at)) : ""));
  const [duration, setDuration] = useState(() => {
    if (!initial) return "30";
    if (!initial.ends_at) return "";
    const minutes = (new Date(initial.ends_at).getTime() - new Date(initial.starts_at).getTime()) / 60000;
    return nearestDuration(minutes);
  });
  const [location, setLocation] = useState(initial?.location ?? "");
  const [agenda, setAgenda] = useState(initial?.agenda ?? "");
  const [remindMinutes, setRemindMinutes] = useState<Set<number>>(
    () => new Set(initial?.remind_minutes ?? [1440, 60])
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clientOptions = [{ value: "", label: "No client" }, ...clients.map((c) => ({ value: c.id, label: c.name }))];
  const availableProjects = clientId ? projects.filter((p) => p.client_id === clientId) : projects;
  const projectOptions = [
    { value: "", label: "No project" },
    ...availableProjects.map((p) => ({ value: p.id, label: p.name })),
  ];

  function onClientChange(value: string) {
    setClientId(value);
    if (projectId && value) {
      const current = projects.find((p) => p.id === projectId);
      if (current && current.client_id !== value) setProjectId("");
    }
  }

  function onProjectChange(value: string) {
    setProjectId(value);
    if (value && !clientId) {
      const project = projects.find((p) => p.id === value);
      if (project) setClientId(project.client_id);
    }
  }

  function toggleRemind(minutes: number) {
    setRemindMinutes((prev) => {
      const next = new Set(prev);
      if (next.has(minutes)) next.delete(minutes);
      else next.add(minutes);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!date || !time) {
      setError("Pick a date and time.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const startsAtDate = new Date(`${date}T${time}`);
      const startsAt = startsAtDate.toISOString();
      const endsAt = duration ? new Date(startsAtDate.getTime() + Number(duration) * 60000).toISOString() : null;

      const res = await fetch(initial ? `/api/events/${initial.id}` : "/api/events", {
        method: initial ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_id: clientId || null,
          project_id: projectId || null,
          title,
          kind,
          starts_at: startsAt,
          ends_at: endsAt,
          location: location || null,
          agenda: agenda || null,
          remind_minutes: Array.from(remindMinutes).sort((a, b) => b - a),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error ?? "That didn't save. Try again.");
        setBusy(false);
        return;
      }
      router.push(initial ? `/calendar/${initial.id}` : `/calendar/${data.id}`);
      router.refresh();
    } catch {
      setError("Network hiccup. Try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-2xl">
      <TextField
        id="event-title"
        label="Title"
        placeholder="Whitesands review call"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
        autoFocus
      />

      <section className="mt-7 grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-2">
        <SelectField
          id="event-kind"
          label="Kind"
          options={EVENT_KINDS}
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        />
        <SelectField
          id="event-client"
          label="Client"
          options={clientOptions}
          value={clientId}
          onChange={(e) => onClientChange(e.target.value)}
        />
      </section>

      <SelectField
        id="event-project"
        label="Project"
        options={projectOptions}
        value={projectId}
        onChange={(e) => onProjectChange(e.target.value)}
        className="mt-7"
      />

      <section className="mt-7 grid grid-cols-1 gap-x-10 gap-y-7 sm:grid-cols-3">
        <div>
          <FieldLabel htmlFor="event-date">Date</FieldLabel>
          <input
            id="event-date"
            type="date"
            className={dateTimeInputClass}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>
        <div>
          <FieldLabel htmlFor="event-time">Time</FieldLabel>
          <input
            id="event-time"
            type="time"
            className={dateTimeInputClass}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </div>
        <SelectField
          id="event-duration"
          label="Duration"
          options={DURATION_OPTIONS}
          value={duration}
          onChange={(e) => setDuration(e.target.value)}
        />
      </section>

      <TextField
        id="event-location"
        label="Location"
        placeholder="Google Meet, phone, their office"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        className="mt-7"
      />

      <TextAreaField
        id="event-agenda"
        label="Agenda"
        rows={3}
        placeholder="What this is for and what must come out of it"
        value={agenda}
        onChange={(e) => setAgenda(e.target.value)}
        className="mt-7"
      />

      <div className="mt-7">
        <FieldLabel htmlFor="event-reminders">Remind me</FieldLabel>
        <div id="event-reminders" className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
          {REMIND_OPTIONS.map((option) => {
            const checked = remindMinutes.has(option.value);
            return (
              <button
                key={option.value}
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggleRemind(option.value)}
                className="group flex items-center gap-3"
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full border transition-colors ${
                    checked ? "border-fg bg-fg" : "border-line group-hover:border-fg"
                  }`}
                />
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-5">
        <SubmitButton busy={busy}>{busy ? "Saving" : initial ? "Save changes" : "Save event"}</SubmitButton>
        <button
          type="button"
          onClick={() => router.push(initial ? `/calendar/${initial.id}` : "/calendar")}
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-fg"
        >
          Cancel
        </button>
        <FormError error={error} />
      </div>
    </form>
  );
}
