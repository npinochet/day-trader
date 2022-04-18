import Faq from './Faq';
import Graph from './Graph';
import Panel from './Panel';

export default function Body() {
  return (
    <div className="flex flex-col w-full md:w-2/3 md:m-10 items-center">
      <Graph />
      <p className='m-4 text-3xl text-white '>
        Will it go <span className="text-green-500">Up</span> or <span className="text-red-500">Down</span>?
      </p>
      <Panel />
      <Faq />
    </div>
  );
}
