import * as flyd from "flyd";

export type Stream<T> = Flyd.Stream<T>;
export type Scanner<T, R> = Flyd.Scanner<T, R>;
export type Mapper<T, R> = Flyd.Mapper<T, R>;

export interface ScannerSpec<T, R> {
  [name: string]: Scanner<T, R> | Scanner<T, R>;
}

export interface MapperSpec<T, R> {
  [name: string]: Mapper<T, R> | Mapper<T, R>;
}

export interface RunParameters<M, P> {
  initial: M;
  scanner: ScannerSpec<P, M>;
  mappers?: Array<MapperSpec<any, any>>;
  copy?: any;//FIXME
}

export interface MeiosisRun<M, P> {
  (params: RunParameters<M, P>): MeiosisApp;
}

export interface MeiosisInstance<M, P> {
  propose: Stream<P>;
  run: MeiosisRun<M, P>;
}

export interface MeiosisApp {
  [key: string]: Stream<any>;
}

interface NamedStream {
  name: string;
  stream: Stream<any>;
}

interface NamedValue {
  name: string;
  value: any;
}

export const {
  combine,
  map,
  merge,
  on,
  scan,
  stream
} = flyd;

const getName = (value: any) => typeof value === "function" ? undefined : Object.keys(value)[0];
const getFn = (value: any) => {
  const name = getName(value);
  return name ? value[name] : value;
};

function newInstance<M, P>(): MeiosisInstance<M, P> {
  const propose: Stream<P> = stream<P>();

  const run = (params: RunParameters<M, P>): MeiosisApp => {
    if (!params.initial || !params.scanner) {
      throw new Error("Please specify initial and scanner.");
    }
    const streams: MeiosisApp = {};
    const allStreams: Array<NamedStream> = [];

    const scanner: ScannerSpec<P, M> = params.scanner;
    const scannerName: string = getName(scanner);
    const scannerFn: Scanner<P, M> = getFn(scanner);

    let lastStream: Stream<any> = scan(scannerFn, params.initial, propose);
    const scannerStream = lastStream;
    scannerName && (streams[scannerName] = lastStream);
    allStreams.push({ name: (scannerName || ""), stream: lastStream });

    (params.mappers || []).forEach(mapper => {
      const mapperName: string = getName(mapper);
      const mapperFn: Mapper<any, any> = getFn(mapper);

      lastStream = map(mapperFn, lastStream);
      mapperName && (streams[mapperName] = lastStream);
      allStreams.push({ name: (mapperName || ""), stream: lastStream });
    });

    //const devtool: boolean = window && window["__MEIOSIS_TRACER_GLOBAL_HOOK__"];
    const devtool: boolean = !!window;
    if (devtool) {
      const copy: any = params.copy || ((model: M) => JSON.parse(JSON.stringify(model)));
      const bufferedValues: Array<any> = [];
      let devtoolInitialized: boolean = false;
      let lastProposal: P = propose();

      window.addEventListener("message", evt => {
        if (evt.data.type === "MEIOSIS_RENDER_MODEL") {
          scannerStream(evt.data.model);
        }
        else if (evt.data.type === "MEIOSIS_TRACER_INIT") {
          devtoolInitialized = true;
          bufferedValues.forEach(values => window.postMessage({ type: "MEIOSIS_VALUES", values }, "*"));
        }
      });

      on(() => {
        const proposal: P = propose();
        // Don't emit if proposal has not changed, because that means the value is coming
        // from the tracer itself. Do emit on the first set of values (no proposal).
        if (!lastProposal || proposal !== lastProposal) {
          lastProposal = proposal;
          const values: Array<NamedValue> = allStreams.map((namedStream: NamedStream) =>
            ({ name: namedStream.name, value: copy(namedStream.stream()) }));
          values.unshift({ name: "proposal", value: proposal });

          if (devtoolInitialized) {
            window.postMessage({ type: "MEIOSIS_VALUES", values }, "*");
          }
          else {
            bufferedValues.push(values);
          }
        }
      }, lastStream);
    }

    return streams;
  };

  return {
    propose,
    run
  };
}

const instance = newInstance<any, any>();
const propose = instance.propose;
const run = instance.run;

export {
  newInstance,
  propose,
  run
};
