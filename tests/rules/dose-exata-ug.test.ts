import { describe, expect, it } from "vitest";
import { produtoDoseExata } from "../../src/contracts/doseReducao.js";
describe("produto decimal de dose em µg",()=>{
 it.each([[0.005,70,0.35],[0.1,3,0.3],[5.5,71,390.5],[1e-7,70,0.000007]])("%s × %s preserva %s",(a,b,r)=>expect(produtoDoseExata(a,b)).toBe(r));
 it.each([[Number.MIN_VALUE,0.1],[Number.MAX_VALUE,2],[Infinity,70],[NaN,70],[-1,70],[0,70]])("recusa produto inválido ou não representável %s × %s",(a,b)=>expect(produtoDoseExata(a,b)).toBeNull());
});
