"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { StateCategory, Task } from "@/lib/api/types";

import { StateDot } from "./bits";
import { TaskCard } from "./TaskCard";

export type MoveTarget = { state_id: number } | { category: StateCategory };

export interface BoardColumn {
  id: string;
  title: string;
  color: string;
  target: MoveTarget;
  matches: (task: Task) => boolean;
}

type Items = Record<string, number[]>;

function buildItems(columns: BoardColumn[], tasks: Task[]): Items {
  const items: Items = Object.fromEntries(columns.map((c) => [c.id, [] as number[]]));
  const sorted = [...tasks].sort((a, b) => a.position - b.position || a.id - b.id);
  for (const task of sorted) {
    const column = columns.find((c) => c.matches(task));
    if (column) items[column.id]!.push(task.id);
  }
  return items;
}

function SortableTask({ task, onOpen, showState }: { task: Task; onOpen: () => void; showState: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: { draggable: !task.can_edit, droppable: false },
  });
  return (
    <TaskCard
      ref={setNodeRef}
      task={task}
      onOpen={onOpen}
      dragging={isDragging}
      showState={showState}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-roledescription={task.can_edit ? "draggable task" : "task"}
      aria-label={`${task.key} ${task.title}`}
    />
  );
}

function Column({
  column,
  taskIds,
  taskById,
  onOpen,
  onQuickAdd,
  showState,
}: {
  column: BoardColumn;
  taskIds: number[];
  taskById: Map<number, Task>;
  onOpen: (task: Task) => void;
  onQuickAdd?: (column: BoardColumn) => void;
  showState: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  return (
    <section
      aria-label={`${column.title}, ${taskIds.length} tasks`}
      className="flex w-[17.5rem] shrink-0 snap-start flex-col rounded-xl bg-surface-2/60 ring-1 ring-border/60"
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <StateDot color={column.color} />
        <h2 className="truncate text-[13px] font-semibold text-fg">{column.title}</h2>
        <span className="rounded-full bg-surface px-1.5 text-[11px] font-medium text-muted ring-1 ring-border">
          {taskIds.length}
        </span>
        {onQuickAdd && (
          <button
            type="button"
            onClick={() => onQuickAdd(column)}
            aria-label={`Add task to ${column.title}`}
            className="ml-auto rounded-md p-1 text-subtle transition-colors hover:bg-surface hover:text-fg"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </header>
      <SortableContext id={column.id} items={taskIds} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`flex min-h-24 flex-1 flex-col gap-2 rounded-b-xl px-2 pb-3 transition-colors ${isOver ? "bg-primary-soft/40" : ""}`}
        >
          {taskIds.map((id) => {
            const task = taskById.get(id);
            return task ? <SortableTask key={id} task={task} onOpen={() => onOpen(task)} showState={showState} /> : null;
          })}
          {taskIds.length === 0 && (
            <p className="rounded-lg border border-dashed border-border-strong/70 px-3 py-6 text-center text-xs text-subtle">
              Drop tasks here
            </p>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

/**
 * Multi-column sortable board. Cards move optimistically inside the board; ``onMove`` persists the
 * new place as "between ``afterId`` and ``beforeId``" and the parent updates ``tasks`` from the server.
 */
export function Board({
  columns,
  tasks,
  onOpen,
  onMove,
  onQuickAdd,
  showState = false,
}: {
  columns: BoardColumn[];
  tasks: Task[];
  onOpen: (task: Task) => void;
  onMove: (task: Task, column: BoardColumn, afterId: number | null, beforeId: number | null) => void;
  onQuickAdd?: (column: BoardColumn) => void;
  showState?: boolean;
}) {
  const [items, setItems] = useState<Items>(() => buildItems(columns, tasks));
  const [activeId, setActiveId] = useState<number | null>(null);
  const [startItems, setStartItems] = useState<Items | null>(null);
  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  // Follow the server, except mid-drag (a refetch must not yank the card from under the pointer).
  // ``columns`` must be memoised by the caller. ``activeId`` is left out on purpose: dropping a card
  // keeps the optimistic order until the parent's ``tasks`` change.
  useEffect(() => {
    if (activeId === null) setItems(buildItems(columns, tasks));
  }, [columns, tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const containerOf = (id: UniqueIdentifier, source: Items = items): string | undefined => {
    if (typeof id === "string" && id in source) return id;
    return Object.keys(source).find((key) => source[key]!.includes(id as number));
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as number);
    setStartItems(items);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = containerOf(active.id);
    const to = containerOf(over.id);
    if (!from || !to || from === to) return;
    setItems((prev) => {
      const fromList = prev[from]!.filter((id) => id !== active.id);
      const toList = [...prev[to]!];
      const overIndex = toList.indexOf(over.id as number);
      const below =
        over.rect && active.rect.current.translated ? active.rect.current.translated.top > over.rect.top + over.rect.height / 2 : false;
      const index = overIndex >= 0 ? overIndex + (below ? 1 : 0) : toList.length;
      toList.splice(index, 0, active.id as number);
      return { ...prev, [from]: fromList, [to]: toList };
    });
  };

  const finish = () => {
    setActiveId(null);
    setStartItems(null);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const id = active.id as number;
    const task = taskById.get(id);
    const to = over ? containerOf(over.id) : undefined;
    if (!task || !to || !startItems) {
      if (startItems) setItems(startItems);
      finish();
      return;
    }
    let list = items[to]!;
    const oldIndex = list.indexOf(id);
    const overIndex = list.indexOf(over!.id as number);
    if (overIndex >= 0 && oldIndex !== overIndex) list = arrayMove(list, oldIndex, overIndex);
    const next = { ...items, [to]: list };
    setItems(next);

    const from = containerOf(id, startItems);
    const index = list.indexOf(id);
    const unchanged = from === to && startItems[to]!.indexOf(id) === index;
    if (!unchanged) {
      const column = columns.find((c) => c.id === to)!;
      onMove(task, column, list[index - 1] ?? null, list[index + 1] ?? null);
    }
    finish();
  };

  const onDragCancel = () => {
    if (startItems) setItems(startItems);
    finish();
  };

  const titleOf = (id: UniqueIdentifier) => {
    const task = taskById.get(id as number);
    return task ? `${task.key} ${task.title}` : "task";
  };
  const columnTitle = (id: UniqueIdentifier | undefined) => {
    const key = id === undefined ? undefined : containerOf(id);
    return columns.find((c) => c.id === key)?.title ?? "the board";
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${titleOf(active.id)} is over ${columnTitle(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) =>
      over ? `${titleOf(active.id)} was dropped in ${columnTitle(over.id)}.` : `${titleOf(active.id)} was dropped.`,
    onDragCancel: ({ active }) => `Moving ${titleOf(active.id)} was cancelled.`,
  };

  const activeTask = activeId !== null ? taskById.get(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: "To move a task, press Space. Use the arrow keys to move it, Space to drop it, Escape to cancel.",
        },
      }}
    >
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
        {columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            taskIds={items[column.id] ?? []}
            taskById={taskById}
            onOpen={onOpen}
            onQuickAdd={onQuickAdd}
            showState={showState}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}>
        {activeTask ? <TaskCard task={activeTask} overlay showState={showState} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
