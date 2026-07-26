import type { TrackingOutput } from "../tracking/types";

const FALLBACK_MARKUP = `
  <svg class="fallback-mascot__svg" viewBox="0 0 1254 1254" role="img"
    aria-label="Interactive mascot fallback preview">
    <rect width="1254" height="1254" fill="#FEF5E6"/>
    <g class="fallback-mascot__feet">
      <path d="M304 1052c-3-28 6-56 33-70 29-15 88-6 137 7 25 7 39 28 33 54-4 23-25 42-56 48H335c-23-8-31-21-31-39Z" fill="#3D3E40" stroke="#1D1E1F" stroke-width="4"/>
      <path d="M665 1049c-1-32 14-55 41-65 38-14 98-12 137-2 26 7 40 30 35 59-4 25-26 44-58 50-30 0-83 0-113-6-26-5-40-19-42-36Z" fill="#3D3E40" stroke="#1D1E1F" stroke-width="4"/>
    </g>
    <g class="fallback-mascot__aim">
      <path d="M970 803c55 52 111 2 107-90-3-68 7-94 57-125 78-49 96-154 35-202-55-44-120 2-126 46" fill="none" stroke="#FD8D02" stroke-width="22" stroke-linecap="round"/>
      <g class="fallback-mascot__body">
        <path d="M225 398C268 277 385 239 588 239c203 0 322 38 367 159 20 53 22 144 17 301-3 94-20 163-69 212-48 48-132 67-315 67-184 0-269-19-316-67-49-49-67-118-69-212-5-157-1-248 22-301Z" fill="#3D3E40" stroke="#1D1E1F" stroke-width="5"/>
        <path d="M250 337 251 191 280 164 426 257 341 302Z" fill="#FD8D02" stroke="#1D1E1F" stroke-width="5"/>
        <path d="m744 257 146-93 29 27 1 146-91-35Z" fill="#FD8D02" stroke="#1D1E1F" stroke-width="5"/>
        <path d="M296 445c24-82 99-118 292-118 192 0 268 36 292 118 17 57 17 258-4 327-23 76-91 100-288 100-198 0-267-24-289-100-21-69-21-270-3-327Z" fill="#FEF2DA" stroke="#1D1E1F" stroke-width="7"/>
        <g class="fallback-mascot__eye fallback-mascot__eye--left">
          <ellipse cx="424" cy="592" rx="97" ry="119" fill="#FEF5E6" stroke="#1D1E1F" stroke-width="5"/>
          <g class="fallback-mascot__pupil fallback-mascot__pupil--left">
            <ellipse cx="446" cy="598" rx="75" ry="96" fill="#1D1E1F"/>
            <circle cx="440" cy="540" r="28" fill="#FEF5E6"/>
            <circle cx="485" cy="657" r="16" fill="#FD8D02"/>
          </g>
          <rect class="fallback-mascot__lid" x="325" y="470" width="202" height="245" rx="100" fill="#FEF2DA"/>
        </g>
        <g class="fallback-mascot__eye fallback-mascot__eye--right">
          <ellipse cx="732" cy="592" rx="100" ry="119" fill="#FEF5E6" stroke="#1D1E1F" stroke-width="5"/>
          <g class="fallback-mascot__pupil fallback-mascot__pupil--right">
            <ellipse cx="711" cy="598" rx="77" ry="96" fill="#1D1E1F"/>
            <circle cx="700" cy="540" r="28" fill="#FEF5E6"/>
            <circle cx="746" cy="657" r="16" fill="#FD8D02"/>
          </g>
          <rect class="fallback-mascot__lid" x="628" y="470" width="208" height="245" rx="100" fill="#FEF2DA"/>
        </g>
        <path d="M576 686c23 0 34 31 25 55-10 28-42 28-51 0-8-24 4-55 26-55Z" fill="#FD8D02" stroke="#1D1E1F" stroke-width="8"/>
      </g>
    </g>
  </svg>
`;

export class FallbackMascotRenderer {
  readonly element: HTMLDivElement;
  readonly #aim: SVGGElement;
  readonly #pupils: NodeListOf<SVGGElement>;
  readonly #lids: NodeListOf<SVGRectElement>;
  #lastBlinkSequence = 0;

  constructor() {
    this.element = document.createElement("div");
    this.element.className = "fallback-mascot";
    this.element.innerHTML = FALLBACK_MARKUP;
    this.#aim = this.element.querySelector<SVGGElement>(
      ".fallback-mascot__aim",
    )!;
    this.#pupils = this.element.querySelectorAll<SVGGElement>(
      ".fallback-mascot__pupil",
    );
    this.#lids = this.element.querySelectorAll<SVGRectElement>(
      ".fallback-mascot__lid",
    );
  }

  update(output: TrackingOutput): void {
    const yawShift = output.bodyYaw * 42;
    const pitchShift = -output.bodyPitch * 28;
    const scaleX = 1 - Math.abs(output.bodyYaw) * 0.12;
    const skewY = output.bodyYaw * -2.5;
    this.#aim.style.transformOrigin = "588px 979px";
    this.#aim.style.transform = `translate(${yawShift}px, ${pitchShift}px) scaleX(${scaleX}) skewY(${skewY}deg)`;

    const pupilX = output.eyeX * 25;
    const pupilY = -output.eyeY * 18;
    this.#pupils.forEach((pupil) => {
      pupil.style.transform = `translate(${pupilX}px, ${pupilY}px)`;
    });

    if (output.blinkSequence !== this.#lastBlinkSequence) {
      this.#lastBlinkSequence = output.blinkSequence;
      this.#lids.forEach((lid) => lid.classList.remove("is-blinking"));
      requestAnimationFrame(() => {
        this.#lids.forEach((lid) => lid.classList.add("is-blinking"));
      });
    }
  }
}
