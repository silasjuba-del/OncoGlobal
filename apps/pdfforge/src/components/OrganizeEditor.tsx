import { useEffect, useState } from 'react';
import { pageThumbnails } from '../engine/render';
import type { PagePlanItem } from '../engine/ops';
import { IconPlus, IconRotate, IconTrash } from './icons';

interface Item extends PagePlanItem {
  key: number;
}

/** Grade de páginas com arrastar-e-soltar, girar, excluir e inserir página em branco. */
export function OrganizeEditor({ bytes, password, onPlan }: { bytes: Uint8Array; password?: string; onPlan(plan: PagePlanItem[]): void }) {
  const [thumbs, setThumbs] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setThumbs(null);
    pageThumbnails(bytes, 150, password)
      .then((t) => {
        if (!alive) return;
        setThumbs(t);
        setItems(t.map((_, i) => ({ key: i, index: i, rotate: 0 })));
      })
      .catch((e) => alive && setError((e as Error).message));
    return () => {
      alive = false;
    };
  }, [bytes, password]);

  useEffect(() => {
    if (thumbs) onPlan(items.map(({ index, rotate }) => ({ index, rotate })));
  }, [items, thumbs, onPlan]);

  if (error) return <p className="err">{error}</p>;
  if (!thumbs) return <p className="muted">Carregando páginas…</p>;

  const move = (from: number, to: number) =>
    setItems((list) => {
      const next = [...list];
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });
  let blankKey = 10_000 + items.length;

  return (
    <div className="organize-grid">
      {items.map((it, pos) => (
        <div
          key={it.key}
          className={`page-card ${drag === pos ? 'dragging' : ''}`}
          draggable
          onDragStart={(e) => {
            setDrag(pos);
            e.dataTransfer.effectAllowed = 'move';
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (drag !== null && drag !== pos) move(drag, pos);
            setDrag(null);
          }}
          onDragEnd={() => setDrag(null)}
        >
          <div className="page-thumb">
            {it.index >= 0 ? (
              <img src={thumbs[it.index]} alt={`Página ${it.index + 1}`} style={{ transform: `rotate(${it.rotate}deg)` }} />
            ) : (
              <div className="blank-page">Em branco</div>
            )}
          </div>
          <div className="page-actions">
            <span className="page-no">{pos + 1}</span>
            {it.index >= 0 && (
              <button
                title="Girar 90°"
                onClick={() => setItems((l) => l.map((x) => (x.key === it.key ? { ...x, rotate: (x.rotate + 90) % 360 } : x)))}
              >
                <IconRotate width={15} height={15} />
              </button>
            )}
            <button title="Excluir página" onClick={() => setItems((l) => l.filter((x) => x.key !== it.key))}>
              <IconTrash width={15} height={15} />
            </button>
            <button
              title="Inserir página em branco depois"
              onClick={() =>
                setItems((l) => {
                  const next = [...l];
                  next.splice(pos + 1, 0, { key: blankKey++ + Math.random(), index: -1, rotate: 0 });
                  return next;
                })
              }
            >
              <IconPlus width={15} height={15} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
