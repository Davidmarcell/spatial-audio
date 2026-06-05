declare module 'globe.gl' {
  type GlobeFactory = GlobeInstance & ((element: HTMLElement) => GlobeInstance);

  type GlobeInstance = {
    globeImageUrl(url: string | null): GlobeFactory;
    bumpImageUrl(url: string): GlobeFactory;
    backgroundColor(color: string): GlobeFactory;
    showAtmosphere(show: boolean): GlobeFactory;
    atmosphereColor(color: string): GlobeFactory;
    atmosphereAltitude(alt: number): GlobeFactory;
    showGraticules(show: boolean): GlobeFactory;
    globeMaterial(material: unknown): GlobeFactory;
    pointsData(data: unknown[]): GlobeFactory;
    pointLat(accessor: string): GlobeFactory;
    pointLng(accessor: string): GlobeFactory;
    pointColor(fn: (point: unknown) => string): GlobeFactory;
    pointAltitude(value: number | ((point: unknown) => number)): GlobeFactory;
    pointRadius(value: number | ((point: unknown) => number)): GlobeFactory;
    pointLabel(fn: (point: unknown) => string): GlobeFactory;
    pointsMerge(merge: boolean): GlobeFactory;
    onPointClick(fn: (point: unknown) => void): GlobeFactory;
    polygonsData(data: unknown[]): GlobeFactory;
    polygonCapColor(fn: (feature: unknown) => string): GlobeFactory;
    polygonSideColor(fn: (feature: unknown) => string): GlobeFactory;
    polygonStrokeColor(fn: (feature: unknown) => string): GlobeFactory;
    polygonAltitude(value: number | ((feature: unknown) => number)): GlobeFactory;
    htmlElementsData(data: unknown[]): GlobeFactory;
    htmlLat(accessor: string): GlobeFactory;
    htmlLng(accessor: string): GlobeFactory;
    htmlAltitude(accessor: string | number): GlobeFactory;
    htmlElement(fn: (point: unknown) => HTMLElement): GlobeFactory;
    ringsData(data: unknown[]): GlobeFactory;
    ringLat(accessor: string): GlobeFactory;
    ringLng(accessor: string): GlobeFactory;
    ringColor(fn: (point: unknown) => string): GlobeFactory;
    ringMaxRadius(value: number | ((point: unknown) => number)): GlobeFactory;
    ringPropagationSpeed(value: number | ((point: unknown) => number)): GlobeFactory;
    ringRepeatPeriod(value: number | ((point: unknown) => number)): GlobeFactory;
    pointOfView(
      pov: { lat?: number; lng?: number; altitude?: number },
      transitionMs?: number,
    ): GlobeInstance;
    width(w: number): GlobeInstance;
    height(h: number): GlobeInstance;
    controls(): { autoRotate: boolean; autoRotateSpeed: number; enableZoom: boolean };
  };

  export default function Globe(): GlobeFactory;
}
