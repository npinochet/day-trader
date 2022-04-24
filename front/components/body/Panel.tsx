import { useState } from 'react';

const Amount = () => {
  const [ amount, setAmount ] = useState(0);
  const maxBalance = 2.231321;

  return (
    <div className="flex flex-grow flex-col p-2 bg-gray-800 rounded mx-3">
      <div className="flex items-center text-gray-400">
        <p>Bet Amount</p>
        <div className="flex-grow" />
        <button
          className="px-2 mx-1 text-md font-bold text-sky-500 bg-gray-600 hover:bg-gray-700 rounded-full"
        >
          50%
        </button>
        <button
          className="px-2 mx-1 text-md font-bold text-sky-500 bg-gray-600 hover:bg-gray-700 rounded-full"
        >
          MAX
        </button>
      </div>
      <div className="flex items-center my-1">
        <span className="absolute ml-1 text-gray-400">Ξ</span>
        <input
          className="flex-grow bg-gray-600 text-lg focus:bg-gray-700 pl-5 focus:outline-none rounded p-1 text-right"
          inputMode="decimal"
          title="Bet Amount"
          autoComplete="off"
          autoCorrect="off"
          type="text"
          pattern="^[0-9]*[.,]?[0-9]*$"
          placeholder="0.0"
          minLength={1}
          maxLength={79}
          // value=""
          spellCheck="false" />
      </div>
      <hr className="border-gray-600 my-2"/>
      <div className="flex items-center text-gray-400">
        <p>Balance</p>
        <div className="flex-grow" />
        <p>{maxBalance}</p>
      </div>
    </div>
  );
};

export default function Panel() {
  const [ bet, setBet ] = useState('');

  const style = (color: string, hoverColor: string, pressed: boolean) => {
    const mainColor = pressed ? hoverColor : color;
    return `${mainColor} hover:${hoverColor} w-60 font-bold text-xl p-4 mx-6 rounded`;
  };

  return (
    <>
      <div className="flex w-full justify-evenly mb-4">
        <button
          onClick={() => bet === 'bull' ? setBet('') : setBet('bull')}
          className={style('bg-green-500', 'bg-green-700', bet === 'bull')}
        >
          ▲ Up
        </button>
        <button
          onClick={() => bet === 'bear' ? setBet('') : setBet('bear')}
          className={style('bg-red-500', 'bg-red-700', bet === 'bear')}
        >
          ▼ Down
        </button>
      </div>
      <div className="flex w-full justify-evenly"><Amount /></div>
      <button
        className="bg-gray-600 hover:bg-gray-700 p-4 my-4 w-60 font-bold text-xl rounded"
      >
        Place Bet!
      </button>
    </>
  );
}
