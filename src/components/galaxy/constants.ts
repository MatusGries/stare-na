/** World-space multiplier for all channel coordinates.
 *  Spreads compact embedding positions into a navigable 3D volume. */
export const COORD_SCALE = 5.5;

/** Camera resting position and look-at for the galaxy overview. */
export const OVERVIEW_CAMERA = {
  position: [2, 20, 44] as [number, number, number],
  target: [0, 0, 10] as [number, number, number],
};

/** Camera-to-star distance when focusing on a selected channel. */
export const FOCUS_DISTANCE = 9;
