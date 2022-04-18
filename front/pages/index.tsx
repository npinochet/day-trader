import Head from 'next/head';
import NavBar from '../components/NavBar';
import Body from '../components/body';

export default function Home() {
  return (
    <div className="bg-gray-700">
      <Head>
        <title>Create Next App</title>
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="flex flex-col items-center stripes">
        <NavBar />
        <Body />
      </main>
    </div>
  );
}
