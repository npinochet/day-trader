// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.9;

contract Test {
    address[] public activePlayers;

    event ActivePlayer(address player);

    function addPlayer() external {
        activePlayers.push(msg.sender);
    }

    function removePlayer(uint[] memory indexes) external {
        for (uint i = 0; i < activePlayers.length; i++) {
            if (includes(indexes, i)) delete activePlayers[i];
        }

        for (uint i = 0; i < activePlayers.length; i++) {
            while (activePlayers[i] == address(0) && activePlayers.length > 0) {
                activePlayers[i] = activePlayers[activePlayers.length-1];
                activePlayers.pop();
            }
        }
    }

    function includes(uint[] memory arr, uint element) internal pure returns (bool) {
        for (uint i = 0; i < arr.length; i++) {
            if (arr[i] == element) return true;
        }
        return false;
    }

    function popPlayer() external {
        activePlayers.pop();
    }

    function emitPlayers() public {
        for (uint i = 0; i < activePlayers.length; i++) {
            emit ActivePlayer(activePlayers[i]);
        }
    }

    function length() external view returns (uint) {
        return activePlayers.length;
    }
}
