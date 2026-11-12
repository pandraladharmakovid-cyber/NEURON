import { useState } from "react";
import type { Label } from "../../lib/types";
import { Button } from "../../components/ui/Button";
export function ClassEditor({
  label,
  index,
  count,
  canDelete,
  disabled,
  onRename,
  onDelete,
}: {
  label: Label;
  index: number;
  count: number;
  canDelete: boolean;
  disabled: boolean;
  onRename: (name: string) => Promise<boolean>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false),
    [name, setName] = useState(label.name);
  return (
    <div className="section-heading">
      <div className="class-heading">
        <span className="class-number">
          {String(index + 1).padStart(2, "0")}
        </span>
        {editing ? (
          <form
            className="inline"
            onSubmit={(e) => {
              e.preventDefault();
              void onRename(name).then((ok) => {
                if (ok) setEditing(false);
              });
            }}
          >
            <label className="field">
              Class name
              <input
                aria-label={`New name for ${label.name}`}
                maxLength={64}
                required
                disabled={disabled}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <Button type="submit" disabled={disabled || !name.trim()}>
              Save class name
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditing(false)}
            >
              Cancel
            </Button>
          </form>
        ) : (
          <button
            className="class-name"
            title="Rename class"
            disabled={disabled}
            onClick={() => {
              setName(label.name);
              setEditing(true);
            }}
          >
            {label.name} <small>edit</small>
          </button>
        )}
      </div>
      <div className="inline">
        <span className="count-pill">{count}</span>
        <Button
          variant="ghost"
          disabled={disabled || !canDelete}
          aria-label={`Delete ${label.name}`}
          onClick={onDelete}
        >
          ×
        </Button>
      </div>
    </div>
  );
}
