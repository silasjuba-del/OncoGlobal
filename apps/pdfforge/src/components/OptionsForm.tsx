import type { Field, Options } from '../tools/types';

/** Formulário genérico gerado a partir de `ToolDef.fields`. */
export function OptionsForm({ fields, value, onChange }: { fields: Field[]; value: Options; onChange(v: Options): void }) {
  const set = (key: string, v: string | number | boolean) => onChange({ ...value, [key]: v });
  return (
    <div className="options-form">
      {fields
        .filter((f) => !f.showIf || f.showIf(value))
        .map((f) => {
          const id = `opt-${f.key}`;
          const v = value[f.key];
          let control: JSX.Element;
          switch (f.type) {
            case 'select':
              control = (
                <select id={id} value={String(v ?? '')} onChange={(e) => set(f.key, e.target.value)}>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              );
              break;
            case 'segmented':
              control = (
                <div className="segmented" role="radiogroup" aria-labelledby={`${id}-label`}>
                  {f.options.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={String(v) === o.value}
                      className={String(v) === o.value ? 'on' : ''}
                      onClick={() => set(f.key, o.value)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              );
              break;
            case 'number':
              control = (
                <div className="with-unit">
                  <input
                    id={id}
                    type="number"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={Number(v ?? 0)}
                    onChange={(e) => set(f.key, e.target.value === '' ? 0 : Number(e.target.value))}
                  />
                  {f.unit && <span className="unit">{f.unit}</span>}
                </div>
              );
              break;
            case 'slider':
              control = (
                <div className="slider">
                  <input
                    id={id}
                    type="range"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={Number(v ?? f.min)}
                    onChange={(e) => set(f.key, Number(e.target.value))}
                  />
                  <output htmlFor={id}>{f.format ? f.format(Number(v)) : String(v)}</output>
                </div>
              );
              break;
            case 'color':
              control = <input id={id} type="color" value={String(v ?? '#000000')} onChange={(e) => set(f.key, e.target.value)} />;
              break;
            case 'checkbox':
              return (
                <label key={f.key} className="check">
                  <input type="checkbox" checked={Boolean(v)} onChange={(e) => set(f.key, e.target.checked)} />
                  <span>{f.label}</span>
                </label>
              );
            default:
              control = (
                <input
                  id={id}
                  type={f.type}
                  value={String(v ?? '')}
                  placeholder={f.placeholder}
                  autoComplete={f.type === 'password' ? 'new-password' : 'off'}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              );
          }
          return (
            <div key={f.key} className="field">
              <label id={`${id}-label`} htmlFor={id}>
                {f.label}
              </label>
              {control}
              {f.help && <small className="help">{f.help}</small>}
            </div>
          );
        })}
    </div>
  );
}
