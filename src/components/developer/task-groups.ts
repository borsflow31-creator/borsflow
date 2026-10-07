const DAY_MS = 86_400_000;

export interface GroupableTask {
    dueAt: string;
    completedAt: string | null;
}

/**
 * Overdue, due today, upcoming and done. "Today" is the viewer's calendar day, so
 * the grouping happens in the browser's zone: a server does not know where the
 * salesperson is, and a follow-up due at 08:00 local would land in the wrong
 * bucket for anyone far from the server's zone.
 *
 * A task due earlier today but not yet done is "today", not overdue: it is late
 * only once the day it was due on has passed.
 */
export function groupTasks<T extends GroupableTask>(tasks: T[], now: Date = new Date()) {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = startOfToday.getTime() + DAY_MS;

    const out = { overdue: [] as T[], today: [] as T[], upcoming: [] as T[], done: [] as T[] };
    for (const task of tasks) {
        if (task.completedAt) {
            out.done.push(task);
            continue;
        }
        const due = new Date(task.dueAt).getTime();
        if (due < startOfToday.getTime()) out.overdue.push(task);
        else if (due < endOfToday) out.today.push(task);
        else out.upcoming.push(task);
    }
    return out;
}
