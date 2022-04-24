import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ethers } from 'ethers';
import Web3Modal from 'web3modal';

let web3Modal: Web3Modal;

const Button = ({ text, clickHandler }: { text: string, clickHandler: () => void}) =>
  <>
    <button
      onClick={clickHandler}
      className="bg-gray-500 hover:bg-gray-700 font-bold py-2 px-4 mr-6 rounded"
    >
      {text}
    </button>
  </>;

export default function NavBar() {
  const [ currentAccount, setCurrentAccount ] = useState('');

  useEffect(() => {
    web3Modal = new Web3Modal({ cacheProvider: true });
    if (web3Modal.cachedProvider) connectWallet();
  }, []);

  const connectWallet = async () => {
    try {
      const instance = await web3Modal.connect();
      const provider = new ethers.providers.Web3Provider(instance);
      const accounts = await provider.listAccounts();
      const network = await provider.getNetwork();
      console.log('Connected to chain:', network.chainId);
      if (accounts) {
        setCurrentAccount(accounts[0]);
        console.log('Found account', accounts[0]);
      }
    } catch (error) {
      console.log('Error connecting wallet', error);
    }
  };

  const disconnectWallet = async () => {
    web3Modal.clearCachedProvider();
    setCurrentAccount('');
    console.log('Wallet disconnected');
  };

  return (
    <div className="flex flex-wrap w-full items-center bg-gray-800 py-4">
      <Link href="/"><a><h1 className="flex-none ml-6 font-bold text-3xl">DayTrader</h1></a></Link>
      <div className="grow"/>
      {currentAccount &&
        <a href={`https://etherscan.io/address/${currentAccount}`} target="_blank" className="hidden sm:block mx-6">
          <p>{currentAccount.slice(0, 5)}...{currentAccount.slice(-5)}</p>
        </a>
      }
      <Button
        text={currentAccount ? 'Disconnect' : 'Connect Wallet'}
        clickHandler={currentAccount ? disconnectWallet : connectWallet}
      />
    </div>
  );
}
