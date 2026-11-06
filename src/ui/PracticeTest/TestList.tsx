import { useState } from "react";
import type { Session } from "../../core/model";

export type TestMenuItem = {
  label: string;
  danger?: boolean;
  onSelect: () => void;
};

export type TestListProps<S extends Session = Session> = {
  title: string;
  /** Already in the order to show. Renders nothing when empty. */
  tests: S[];
  /** Text after the start date, e.g. "timed" or "3 de 5 correctas". */
  meta: (session: S) => string;
  openLabel: (session: S) => string;
  /** Accessible name of the ••• button. */
  actionsLabel: (session: S) => string;
  menuItems: (session: S) => TestMenuItem[];
  onOpen: (id: string) => void;
};

/** Practice Tests or timed tests, each with an open button and an actions menu. */
export const TestList = <S extends Session>({
  title,
  tests,
  meta,
  openLabel,
  actionsLabel,
  menuItems,
  onOpen,
}: TestListProps<S>) => {
  const [menuId, setMenuId] = useState("");
  if (!tests.length) return null;
  return (
    <section className="utility practice-test-list-section">
      <h2>{title}</h2>
      <div className="practice-test-list" role="list">
        {tests.map((session) => (
          <div className="practice-test-row" role="listitem" key={session.id}>
            <div className="practice-test-row-copy">
              <span className="practice-test-row-name">{session.name}</span>
              <span className="practice-test-row-meta">
                {`${new Date(session.startedAt).toLocaleDateString()} · ${meta(session)}`}
              </span>
            </div>
            <div className="practice-test-row-actions">
              <button onClick={() => onOpen(session.id)}>
                {openLabel(session)}
              </button>
              <div className="session-action-wrap">
                <button
                  className="session-menu-trigger"
                  aria-label={actionsLabel(session)}
                  aria-expanded={menuId === session.id}
                  onClick={() =>
                    setMenuId(menuId === session.id ? "" : session.id)
                  }
                >
                  •••
                </button>
                {menuId === session.id && (
                  <div className="session-menu" role="menu">
                    {menuItems(session).map((item) => (
                      <button
                        key={item.label}
                        className={item.danger ? "danger" : undefined}
                        role="menuitem"
                        onClick={() => {
                          setMenuId("");
                          item.onSelect();
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
