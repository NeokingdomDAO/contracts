// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract VotingMock {
    event AfterTokenTransferCalled(address from, address to, uint256 amount);

    function afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) external {
        emit AfterTokenTransferCalled(from, to, amount);
    }
}
