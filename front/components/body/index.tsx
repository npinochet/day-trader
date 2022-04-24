import Faq from './Faq';
import Graph from './Graph';
import Panel from './Panel';
import Footer from './Footer';

export default function Body() {
  return (
    <>
      <div className="flex flex-col w-full md:w-2/3 md:m-10 mb-10 items-center">
        <Graph />
        <p className='m-4 text-3xl text-justify' style={{ textJustify: 'inter-character' }}>
          Will the price go <span className="text-green-500">Up</span> or <span className="text-red-500">Down</span>?
        </p>
        <Panel />
        <hr className="border-gray-600 w-[90%] m-6 border-2 opacity-50"/>
        <Faq />
      </div>
      <Footer />
    </>
  );
}
