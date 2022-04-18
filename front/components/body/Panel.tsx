
export default function Panel() {
  return (
    <div className="flex w-full justify-evenly">
      <button className="bg-green-500 hover:bg-green-700 w-60 text-white font-bold text-xl py-4 px-4 mx-6 rounded drop-shadow-sm">Up</button>
      <button className="bg-red-500   hover:bg-red-700   w-60 text-white font-bold text-xl py-4 px-4 mx-6 rounded drop-shadow-sm">Down</button>
    </div>
  );
}
