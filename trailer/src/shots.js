// Master shot list (edit decision list). Each shot: { id, t0, t1, make() -> { scene, camera, update(lt, t, dur), K, shutter, grade } }
import { A_SHOTS } from './shots_a.js';
import { B_SHOTS } from './shots_b.js';
import { C_SHOTS } from './shots_c.js';
import { D_SHOTS } from './shots_d.js';
import { E_SHOTS } from './shots_e.js';

export const SHOTS = [...A_SHOTS, ...B_SHOTS, ...C_SHOTS, ...D_SHOTS, ...E_SHOTS];
