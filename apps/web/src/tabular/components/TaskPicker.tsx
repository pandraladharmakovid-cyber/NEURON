import type { Task } from "../types";
export function TaskPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: Task;
  onChange: (task: Task) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="csv-task-select" disabled={disabled}>
      <legend>What should your model predict?</legend>
      <label>
        <input
          type="radio"
          name="tabular-task"
          checked={value === "classification"}
          onChange={() => onChange("classification")}
        />{" "}
        Classification — a category
      </label>
      <label>
        <input
          type="radio"
          name="tabular-task"
          checked={value === "regression"}
          onChange={() => onChange("regression")}
        />{" "}
        Regression — a number
      </label>
    </fieldset>
  );
}
