// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract DayTraderV1 is Ownable, Pausable {
    struct Bet {
        bool active;
        bool bullish;
        bool readyToClaim;
        uint80 startRoundId;
        uint startTimestamp;
        uint amount;
    }

    uint public constant BET_WINDOW = 1 days;
    uint public constant MAX_TREASURY_FEE = 100; // 10%

    mapping(address => Bet) public bets; // should be public? what if someone changes it with another smart contract
    address[] public activePlayers;
    uint public reservedBalance;

    uint public treasuryBalance;
    uint public treasuryFee;

    AggregatorV3Interface private oracle;

    event PlacedBet(address indexed sender, uint amount, bool bullish);
    event ClaimedReward(address indexed sender, uint amount);

    constructor(uint _treasuryFee, address oracleAddress) {
        treasuryFee = _treasuryFee;
        oracle = AggregatorV3Interface(oracleAddress); // 0x9326BFA02ADD2366b30bacB125260Af641031331
    }

    function placeBet(bool bullish) external payable whenNotPaused {
        uint maxAmount = maxBettingAmount();
        require(maxAmount > 0, "No enough balance in betting pool.");
        require(msg.value <= maxAmount, "Betting amount too big, disallowed.");

        Bet storage bet = bets[msg.sender];
        require(!bet.active, "Bet already active.");
        (uint80 roundId , , , , ) = oracle.latestRoundData();

        bet.startRoundId = roundId;
        bet.active = true;
        bet.bullish = bullish;
        bet.amount = msg.value;
        bet.startTimestamp = block.timestamp;

        reservedBalance += msg.value;

        activePlayers.push(msg.sender);
        emit PlacedBet(msg.sender, msg.value, bullish);
    }

    function claimReward(uint80 endRoundId) external {
        Bet storage bet = bets[msg.sender];
        require(bet.active, "No active bet found, or lost bet.");
        require(bet.readyToClaim || fastBetResult(msg.sender, endRoundId), "Bet lost, nothing to claim.");

        uint reward = bet.amount * 2;
        uint fees = (reward * treasuryFee) / 1000;
        treasuryBalance += fees;

        reservedBalance -= bet.amount; // reviews this, what happend if readyToClaim is false, should fastBetResult be necesary?
        payable(msg.sender).transfer(reward - fees);
        bet.active = false;
        emit ClaimedReward(msg.sender, bet.amount);
    }

    function betResult(address player) public view returns(bool) {
        return fastBetResult(player, getEndRoundId(player));
    }

    function getEndRoundId(address player) public view returns(uint80) {
        Bet storage bet = bets[player];
        require(bet.active, "No active bet found.");

        uint dueTimestamp = bet.startTimestamp + BET_WINDOW;
        require(block.timestamp >= dueTimestamp, "Bet not due yet.");

        uint80 roundId = bet.startRoundId;
        uint oracleTimestamp = bet.startTimestamp;
        while (oracleTimestamp < dueTimestamp) {
            roundId += 1;
            (, , , oracleTimestamp, ) = oracle.getRoundData(roundId);
            require(oracleTimestamp > 0, "Not price data yet, try later.");
        }

        return roundId;
    }

    function fastBetResult(address player, uint80 endRoundId) public view returns(bool) {
        Bet storage bet = bets[player];
        require(bet.active, "No bet placed yet.");

        uint dueTimestamp = bet.startTimestamp + BET_WINDOW;
        (, int startPrice, , , ) = oracle.getRoundData(bet.startRoundId);
        (, int endPrice, , uint endTimestamp, ) = oracle.getRoundData(endRoundId);
        (, , , uint preEndTimestamp, ) = oracle.getRoundData(endRoundId - 1);
        require(endTimestamp >= dueTimestamp && preEndTimestamp < dueTimestamp, "Invalid endRoundId.");

        return (endPrice >= startPrice) == bet.bullish;
    }

    function closeActiveBets() external {
        for (uint i = 0; i < activePlayers.length; i++) {
            Bet storage bet = bets[activePlayers[i]];

            try this.betResult(activePlayers[i]) returns (bool result) {
                if (result) {
                    bet.readyToClaim = true;
                    continue;
                }
                reservedBalance -= bet.amount;
                bet.active = false;

                delete activePlayers[i];
            } catch {
                continue;
            }
        }

        for (uint i = 0; i < activePlayers.length; i++) {
            while (activePlayers[i] == address(0) && activePlayers.length > 0) {
                activePlayers[i] = activePlayers[activePlayers.length - 1];
                activePlayers.pop();
            }
        }
    }

    function maxBettingAmount() public view returns(uint) {
        uint availableBalance = address(this).balance - reservedBalance - treasuryBalance;
        return availableBalance >> 1;
    }

    function updateTreasuryFee(uint _treasuryFee) external onlyOwner {
        require(_treasuryFee <= MAX_TREASURY_FEE, "Treasury fee too high.");
        treasuryFee = _treasuryFee;
    }

    function claimTreasury() external onlyOwner {
        require(treasuryBalance > 0, "No treasury to claim.");
        payable(owner()).transfer(treasuryBalance);
        treasuryBalance = 0;
    }

    function pause() external whenNotPaused onlyOwner {
        _pause();
    }

    function unpause() external whenPaused onlyOwner {
        _unpause();
    }
}
