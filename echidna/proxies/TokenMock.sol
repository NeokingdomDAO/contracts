// SPDX-License-Identifier: MIT

pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TokenMock is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }
}
