import Link from 'next/link';

export default function NavBar() {
  return (
    <div className="flex flex-wrap w-full items-center bg-gray-800 py-4 drop-shadow-lg">
      <Link href="/"><a><h1 className="flex-none text-white mx-6 font-bold text-3xl">DayTrader</h1></a></Link>
      <div className="grow"/>
      <button className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 mx-6 rounded">
        Connect Wallet
      </button>
    </div>
  );
}
