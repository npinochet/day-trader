import { expect } from 'chai';
import { ethers, waffle, network } from 'hardhat';
import { MockContract } from 'ethereum-waffle';
import { Contract } from 'ethers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import AggregatorV3Abi from '@chainlink/contracts/abi/v0.8/AggregatorV3Interface.json';

describe('DayTraderV1', () => {
	const treasuryFee = 30;
	const betAmount = 0.1;

	let oracle: MockContract;
	let dayTrader: Contract;
	let owner: SignerWithAddress;
	let addresses: SignerWithAddress[];

	const toEth = (value: string | number) => ethers.utils.parseEther(value.toString());
	const now = () => Math.floor(Date.now() / 1000);
	const placeBet = (bullish: boolean) => dayTrader.placeBet(bullish, { value: toEth(betAmount) });
	const forward = async (time: number) => {
		await network.provider.send('evm_increaseTime', [ time ]);
		await network.provider.send('evm_mine');
	};
	const loadOracleData = async (roundData: [ number, number ][]) => {
		const promises = roundData.map(([ updatedAt, answer ], i) => [ i, answer, updatedAt, updatedAt, 0 ])
			.map((data, i) => oracle.mock.getRoundData.withArgs(i).returns(...data));
		await Promise.all(promises);

		const lastRound = roundData.length - 1;
		const [ updatedAt, answer ] = roundData[lastRound];
		await oracle.mock.latestRoundData.returns(lastRound, answer, updatedAt, updatedAt, 0);
		await oracle.mock.getRoundData.withArgs(roundData.length).returns(0, 0, 0, 0, 0);
	};

	beforeEach(async () => {
		await network.provider.send('hardhat_reset');
		[ owner, ...addresses ] = await ethers.getSigners();

		const aggregatorV3 = await waffle.deployMockContract(owner, AggregatorV3Abi);
		await aggregatorV3.deployed();
		oracle = aggregatorV3;
		await loadOracleData([ [ 0, 100 ] ]);

		const DayTrader = await ethers.getContractFactory('DayTraderV1');
		dayTrader = await DayTrader.deploy(treasuryFee, aggregatorV3.address);
		await dayTrader.deployed();
	});

	describe('#placeBet', () => {
		context('Contract has no balance', () => {
			it('Should error if no balance', async () => {
				const message = 'No enough balance in betting pool.';
				const maxBetAmount = await dayTrader.maxBetAmount();
				expect(maxBetAmount).be.equal('0');
				await expect(placeBet(true)).be.revertedWith(message);
			});
		});

		context('Contract has balance', () => {
			beforeEach(async () => {
				await owner.sendTransaction({ to: dayTrader.address, value: toEth('1') });
			});

			it('Should require value to place a bet', async () => {
				const message = 'Betting amount required.';
				await expect(dayTrader.placeBet(true)).be.revertedWith(message);
			});

			it('Should not be able to place more than one bet', async () => {
				const message = 'Bet already active.';
				await expect(placeBet(true)).be.not.revertedWith(message);
				await expect(placeBet(true)).be.revertedWith(message);
			});

			it('Should not be able to bet more than available amount', async () => {
				const tx = dayTrader.placeBet(true, { value: toEth('0.500001') });
				const message = 'Betting amount too big, disallowed.';
				await expect(tx).be.revertedWith(message);
			});

			it('Should reserve amount after bet', async () => {
				let maxBetAmount = await dayTrader.maxBetAmount();
				expect(maxBetAmount).be.equal(toEth('0.5'));
				await placeBet(true);
				maxBetAmount = await dayTrader.maxBetAmount();
				expect(maxBetAmount).be.equal(toEth('0.45'));
				const reservedAmount = await dayTrader.reservedBalance();
				expect(reservedAmount).be.equal(toEth('0.2'));
			});

			it('Should be able to place a bet', async () => {
				let bet = await dayTrader.bets(owner.address);
				expect(bet.active).be.equal(false);
				await placeBet(true);
				bet = await dayTrader.bets(owner.address);
				expect(bet.active).be.equal(true);
			});

			it('Should be able to be pause \'placeBet\'', async () => {
				const message = 'Pausable: pause';
				await expect(placeBet(true)).be.not.revertedWith(message);
				await dayTrader.pause();
				await expect(placeBet(true)).be.revertedWith(message);
			});
		});
	});

	describe('#claimReward', () => {
		let roundData: [ number, number ][];

		beforeEach(async () => {
			await owner.sendTransaction({ to: dayTrader.address, value: toEth('1') });
			roundData = [ [ now(), 100 ] ];
			await loadOracleData(roundData);
		});

		it('Should not be able to claim if not placed bet', async () => {
			const message = 'No active bet found, or lost bet.';
			await expect(dayTrader.claimReward()).be.revertedWith(message);
		});

		it('Should not be able to claim reward right away', async () => {
			await placeBet(true);
			const message = 'Bet ongoing, nothing to claim.';
			await expect(dayTrader.claimReward()).be.revertedWith(message);
		});

		it('Should not be able to claim reward if lost', async () => {
			const betWindow = (await dayTrader.BET_WINDOW()).toNumber();

			await placeBet(false);

			await forward(betWindow);
			roundData.push([ now() + betWindow + 10, 200 ]);
			await loadOracleData(roundData);

			const message = 'No active bet found, or lost bet.';
			await expect(dayTrader.claimReward()).be.revertedWith(message);
		});

		it('Should be able to claim reward', async () => {
			const betWindow = (await dayTrader.BET_WINDOW()).toNumber();

			await placeBet(true);

			await forward(betWindow);
			roundData.push([ now() + betWindow + 10, 200 ]);
			await loadOracleData(roundData);

			await expect(dayTrader.claimReward()).be.not.reverted;

			const fees = betAmount * 2 * treasuryFee / 1000;
			expect(await dayTrader.treasuryBalance()).be.equal(toEth(fees));
		});
	});

	describe('#closeActiveBets', () => {
		let roundData: [ number, number ][];

		beforeEach(async () => {
			await owner.sendTransaction({ to: dayTrader.address, value: toEth('1') });
			roundData = [ [ now(), 100 ] ];
			await loadOracleData(roundData);
		});

		it('Should remove only finished bets', async () => {
			const betWindow = (await dayTrader.BET_WINDOW()).toNumber();

			await dayTrader.connect(addresses[1]).placeBet(true, { value: toEth(betAmount) });
			await forward(betWindow);
			await dayTrader.connect(addresses[2]).placeBet(false, { value: toEth(betAmount) });

			const activePlayers = await Promise.all([ 0, 1 ].map(i => dayTrader.activePlayers(i)));
			expect(activePlayers).be.eql([ 1, 2 ].map(i => addresses[i].address));

			roundData.push([ now() + betWindow + 10, 200 ]);
			await loadOracleData(roundData);
			await dayTrader.closeActiveBets();

			const activePlayer = await dayTrader.activePlayers(0);
			expect(activePlayer).be.eql(addresses[2].address);

			await expect(dayTrader.activePlayers(1)).be.reverted;
		});

		it('Should free losing bets reserves', async () => {
			const betWindow = (await dayTrader.BET_WINDOW()).toNumber();

			let maxBetAmount = await dayTrader.maxBetAmount();
			expect(maxBetAmount).be.equal(toEth('0.5'));

			await dayTrader.connect(addresses[1]).placeBet(false, { value: toEth(betAmount) });
			await dayTrader.connect(addresses[2]).placeBet(true, { value: toEth(betAmount) });
			await dayTrader.connect(addresses[3]).placeBet(false, { value: toEth(betAmount) });

			await forward(betWindow);
			roundData.push([ now() + betWindow + 10, 200 ]);
			await loadOracleData(roundData);

			maxBetAmount = await dayTrader.maxBetAmount();
			expect(maxBetAmount).be.equal(toEth('0.35'));

			await dayTrader.closeActiveBets();
			await expect(dayTrader.activePlayers(0)).be.reverted;

			maxBetAmount = await dayTrader.maxBetAmount();
			expect(maxBetAmount).be.equal(toEth('0.55'));
		});

		it.skip('Stress test for gas calculation', async () => {
			const betWindow = (await dayTrader.BET_WINDOW()).toNumber();

			let time = now();
			const players = addresses.map(async address => {
				await address.sendTransaction({ to: dayTrader.address, value: toEth('1') });

				await dayTrader.connect(address).placeBet(Math.random() > 0.5, { value: toEth(betAmount) });
				await forward(betWindow);

				const price = 50 + Math.random() * 150;
				time += betWindow / 2;
				roundData.push([ time, Math.floor(price) ]);
				await loadOracleData(roundData);
			});
			await Promise.all(players);

			await expect(dayTrader.closeActiveBets()).be.not.reverted;
		});
	});

	describe('#claimTreasury', () => {
		it('Should not be able to claim if empty', async () => {
			await expect(dayTrader.claimTreasury()).be.revertedWith('No treasury to claim.');
		});

		it('Should only be called by owner', async () => {
			await expect(dayTrader.connect(addresses[1]).claimTreasury())
				.be.revertedWith('Ownable: caller is not the owner');
		});
	});

	describe('#updateTreasuryFee', () => {
		it('Should be able to update treasury fee', async () => {
			expect(await dayTrader.treasuryFee()).be.equal(30);
			await dayTrader.updateTreasuryFee(90);
			expect(await dayTrader.treasuryFee()).be.equal(90);
		});

		it('Should not be able to surpass 10%', async () => {
			await expect(dayTrader.updateTreasuryFee(110)).be.revertedWith('Treasury fee too high.');
		});

		it('Should only be called by owner', async () => {
			await expect(dayTrader.connect(addresses[1]).updateTreasuryFee(10))
				.be.revertedWith('Ownable: caller is not the owner');
		});
	});
});
