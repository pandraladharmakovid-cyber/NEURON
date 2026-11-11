export function NotFoundPage() {
  return (
    <div className="empty-state">
      <h1>That page isn’t here.</h1>
      <p>Your projects are still in your local workspace.</p>
      <a className="btn btn-primary" href="#/projects">
        Back to projects
      </a>
    </div>
  );
}