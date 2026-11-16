import { ProgressRing } from "@/components/ui/ProgressRing";
import type { Project } from "@/lib/api/types";

/** Weighted progress (from milestones) next to the plain task count it is built from. */
export function ProjectProgress({ project, size = 56 }: { project: Project; size?: number }) {
  const unallocated = project.milestone_count > 0 && project.milestone_weight_total < 100;
  return (
    <div className="flex items-center gap-3">
      <ProgressRing value={project.progress} size={size} label={`${project.short_code} progress`} />
      <div className="min-w-0 text-xs text-muted">
        <p className="font-medium text-fg">
          {project.completed_task_count} of {project.task_count} tasks done
        </p>
        <p className="mt-0.5">
          {project.milestone_count === 0
            ? "Add milestones to track progress"
            : unallocated
              ? `Milestones cover ${project.milestone_weight_total}% of the project`
              : `${project.milestone_count} milestones`}
        </p>
      </div>
    </div>
  );
}
