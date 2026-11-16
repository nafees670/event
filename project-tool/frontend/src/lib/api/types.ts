export type OrgRole = "ADMIN" | "MEMBER" | "GUEST";
export type SpaceRole = "MANAGER" | "EMPLOYEE" | "GUEST";
export type DepartmentType = "ENGINEERING" | "MARKETING" | "SALES" | "OPERATIONS" | "HR" | "GENERAL";
export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface UserSummary {
  id: number;
  email: string;
  full_name: string;
  display_name: string;
  avatar: string | null;
}

export interface User extends UserSummary {
  is_verified: boolean;
  points: number;
  date_joined: string;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
  my_role: OrgRole;
  member_count: number;
  created_at: string;
}

export interface MemberSpace {
  membership_id: number;
  space_id: number;
  name: string;
  short_code: string;
  role: SpaceRole;
}

export interface OrgMember {
  id: number;
  user: UserSummary;
  role: OrgRole;
  spaces: MemberSpace[];
  created_at: string;
}

export interface Invitation {
  id: number;
  email: string;
  role: OrgRole;
  space: number | null;
  space_name: string | null;
  space_role: SpaceRole | "";
  status: InvitationStatus;
  invited_by: UserSummary | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  /** Only present right after create/resend. */
  invite_url?: string;
}

export interface PublicInvitation {
  email: string;
  role: OrgRole;
  organization_name: string;
  space_name: string | null;
  invited_by_name: string | null;
  status: InvitationStatus;
  expires_at: string;
}

export interface Space {
  id: number;
  name: string;
  short_code: string;
  department_type: DepartmentType;
  color: string;
  description: string;
  my_role: SpaceRole | null;
  member_count: number;
  created_at: string;
}

export interface SpaceMember {
  id: number;
  user: UserSummary;
  role: SpaceRole;
  created_at: string;
}

export interface Detail {
  detail: string;
}

// --- Workflow, projects and tasks (Phase 2) ---------------------------------------

export type StateCategory = "BACKLOG" | "UNSTARTED" | "STARTED" | "REVIEW" | "COMPLETED" | "CANCELLED";
export type Priority = "URGENT" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
export type FieldType = "text" | "number" | "date" | "select" | "user";
export type ProjectStatus = "ACTIVE" | "ON_HOLD" | "COMPLETED" | "ARCHIVED";
export type MilestoneStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

export interface WorkflowState {
  id: number;
  name: string;
  color: string;
  category: StateCategory;
  order: number;
  is_default: boolean;
  task_count: number;
}

export interface CustomField {
  id: number;
  name: string;
  field_type: FieldType;
  options: string[];
  required: boolean;
  order: number;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface Project {
  id: number;
  space: number;
  space_code: string;
  name: string;
  short_code: string;
  description: string;
  status: ProjectStatus;
  lead: UserSummary | null;
  start_date: string | null;
  target_date: string | null;
  repo_url: string;
  docs_url: string;
  drive_url: string;
  task_count: number;
  completed_task_count: number;
  milestone_count: number;
  milestone_weight_total: number;
  /** Weighted progress, 0-100: sum of milestone weight x share of its tasks done. */
  progress: number;
  can_manage: boolean;
  created_at: string;
  updated_at: string;
}

export interface Milestone {
  id: number;
  name: string;
  description: string;
  weight: number;
  due_date: string | null;
  status: MilestoneStatus;
  status_overridden: boolean;
  overridden_by: UserSummary | null;
  overridden_at: string | null;
  order: number;
  task_count: number;
  completed_task_count: number;
  /** Share of the milestone's tasks done, 0-100. */
  progress: number;
  created_at: string;
}

export type CustomFieldValue = string | number;

export interface Task {
  id: number;
  key: string;
  number: number;
  space: number;
  project: { id: number; name: string; short_code: string };
  title: string;
  description: string;
  state: { id: number; name: string; color: string; category: StateCategory };
  priority: Priority;
  milestone: { id: number; name: string } | null;
  assignees: UserSummary[];
  tags: Tag[];
  start_date: string | null;
  due_date: string | null;
  custom_fields: Record<string, CustomFieldValue>;
  position: number;
  completed_at: string | null;
  created_by: UserSummary | null;
  comment_count: number;
  attachment_count: number;
  can_edit: boolean;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: number;
  author: UserSummary | null;
  body: string;
  edited_at: string | null;
  created_at: string;
  can_edit: boolean;
}

export interface Attachment {
  id: number;
  filename: string;
  size: number;
  content_type: string;
  uploaded_by: UserSummary | null;
  created_at: string;
  download_url: string;
}

export interface Activity {
  id: number;
  actor: UserSummary | null;
  verb: "created" | "updated" | "moved" | "commented" | "attached" | "detached";
  field: string;
  old_value: string;
  new_value: string;
  created_at: string;
}

// --- Analytics (Phase 3) ------------------------------------------------------------

export interface AnalyticsKpis {
  total: number;
  open: number;
  in_progress: number;
  completed: number;
  overdue: number;
  due_this_week: number;
  completed_last_7_days: number;
}

export interface AnalyticsProject {
  id: number;
  name: string;
  short_code: string;
  space: number;
  space_code: string;
  status: ProjectStatus;
  target_date: string | null;
  progress: number;
  open_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
}

export interface WorkloadRow {
  user: UserSummary;
  open: number;
  in_progress: number;
  overdue: number;
  completed_last_30_days: number;
  /** Open tasks as a percentage of ``capacity``. */
  utilization: number;
}

export interface AnalyticsSpace {
  id: number;
  name: string;
  short_code: string;
  color: string;
  open_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  project_count: number;
  average_progress: number;
}

export interface Analytics {
  generated_at: string;
  capacity: number;
  kpis: AnalyticsKpis;
  velocity: { week_start: string; completed: number }[];
  status_distribution: { category: StateCategory; label: string; count: number }[];
  priority_distribution: { priority: Priority; label: string; count: number }[];
  projects: AnalyticsProject[];
  workload: WorkloadRow[];
  /** Only in the company-wide view. */
  spaces?: AnalyticsSpace[];
}
