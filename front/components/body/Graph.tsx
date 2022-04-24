import { SymbolOverview } from 'react-ts-tradingview-widgets';

const SSR = typeof window === 'undefined';

export default function Graph() {
  return (
    <div className="container rounded bg-cyan-900 h-96 text-center pb-8" style={{ backgroundColor: '#1e222d' }}>
      {!SSR && <SymbolOverview
        symbols={[ [ 'BTC', 'BITSTAMP:BTCUSD|1D' ] ]}
        colorTheme="dark"
        scalePosition="left"
        autosize
        chartOnly
        noTimeScale
        borderDownColor='#1e222d'
        // copyrightStyles={{ parent: { opacity: 0 } }}
      />}
    </div>
  );
}
