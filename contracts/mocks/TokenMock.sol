// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TokenMock is ERC20 {
    constructor() ERC20("TokenMock", "TM") {}

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}
