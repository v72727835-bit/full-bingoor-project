'use client';

import React from 'react';
import { Crumbs } from './Crumbs';
import s from './LegalPage.module.css';

export interface LegalItem {
  kind: 'p' | 'li';
  text: string;
}

export interface LegalSection {
  heading: string | null;
  items: LegalItem[];
}

/**
 * Renders a policy document. The content is data, not markup, so the wording
 * stays exactly as it was supplied and only the presentation lives here.
 */
export function LegalPage({
  title,
  updated,
  sections,
  crumb,
}: {
  title: string;
  updated?: string;
  sections: LegalSection[];
  crumb: string;
}) {
  return (
    <div className="page rise">
      <Crumbs trail={[{ label: crumb }]} />

      <header className={s.head}>
        <h1 className="h1">{title}</h1>
        {updated ? <p className={s.updated}>{updated}</p> : null}
      </header>

      <article className={s.doc}>
        {sections.map((section, i) => (
          <section key={i} className={s.sec}>
            {section.heading ? <h2 className={s.secTitle}>{section.heading}</h2> : null}
            {groupRuns(section.items).map((run, j) =>
              run.kind === 'li' ? (
                <ul key={j} className={s.list}>
                  {run.texts.map((text, k) => (
                    <li key={k}>{text}</li>
                  ))}
                </ul>
              ) : (
                <React.Fragment key={j}>
                  {run.texts.map((text, k) => (
                    <p key={k} className={s.para}>
                      {text}
                    </p>
                  ))}
                </React.Fragment>
              ),
            )}
          </section>
        ))}
      </article>
    </div>
  );
}

/** Consecutive list items become one <ul> so the bullets group correctly. */
function groupRuns(items: LegalItem[]): { kind: 'p' | 'li'; texts: string[] }[] {
  const runs: { kind: 'p' | 'li'; texts: string[] }[] = [];
  for (const item of items) {
    const last = runs[runs.length - 1];
    if (last && last.kind === item.kind) last.texts.push(item.text);
    else runs.push({ kind: item.kind, texts: [item.text] });
  }
  return runs;
}
