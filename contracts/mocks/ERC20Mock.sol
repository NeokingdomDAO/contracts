// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../Voting/Voting.sol";

contract ERC20Mock is ERC20 {
    Voting _voting;

    constructor(Voting voting) ERC20("Mock", "MOCK") {
        _voting = voting;
    }

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        _voting.afterTokenTransfer(from, to, amount);
    }
}
