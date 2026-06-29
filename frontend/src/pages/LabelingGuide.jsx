import { Link } from 'react-router-dom';
import { LABELING_GUIDE_QUICK_LINKS, LABELING_GUIDE_SECTIONS } from '../data/labelingGuide';

export default function LabelingGuide() {
  return (
    <div className="labeling-guide-page">
      <div className="page-header">
        <h1>Video labeling guide</h1>
        <p>
          Complete rules for marking football events. Read this before labeling clips and keep it open
          while you work. Official definitions live on the{' '}
          <Link to="/terminology">Terminology</Link> page.
        </p>
      </div>

      <nav className="labeling-guide-toc" aria-label="Guide sections">
        <h2 className="labeling-guide-toc-title">On this page</h2>
        <ul>
          {LABELING_GUIDE_SECTIONS.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.title}</a>
            </li>
          ))}
        </ul>
        <div className="labeling-guide-quick-links">
          {LABELING_GUIDE_QUICK_LINKS.map((link) => (
            <Link key={link.to} to={link.to}>
              {link.label} →
            </Link>
          ))}
        </div>
      </nav>

      <div className="labeling-guide-sections">
        {LABELING_GUIDE_SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="labeling-guide-section card">
            <h2>{section.title}</h2>
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="labeling-guide-footer">
        Submit is blocked until spacing and football rules pass. In the labeling view, click{' '}
        <strong>?</strong> for a short reminder or return here for the full guide.
      </p>
    </div>
  );
}
