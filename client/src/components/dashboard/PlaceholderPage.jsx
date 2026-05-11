/**
 * @param {{ title: string, description?: string }} props
 */
export function PlaceholderPage({ title, description }) {
  return (
    <section className="card module-card">
      <h2 className="section-title section-title-sm">{title}</h2>
      <p className="section-desc">
        {description ||
          'This module is not wired up yet. Use the sidebar to explore other areas of the app.'}
      </p>
    </section>
  );
}
