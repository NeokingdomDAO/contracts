// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "../RedemptionController/IRedemptionController.sol";
import "../Voting/IVoting.sol";
import "../InternalMarket/InternalMarket.sol";
import "../extensions/DAORegistryProxy.sol";
import "./IGovernanceToken.sol";

abstract contract GovernanceTokenBase is
    ERC20Upgradeable,
    IGovernanceToken,
    DAORegistryProxy
{
    event VestingSet(address to, uint256 amount);

    function _initialize(
        string memory name,
        string memory symbol
    ) internal virtual {
        __ERC20_init(name, symbol);
    }

    // TODO: what happens to vesting tokens when someone loses the contributor status?
    // In theory they should be burned or added to a pool
    mapping(address => uint256) internal _vestingBalance;

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        super._beforeTokenTransfer(from, to, amount);
    }

    // TODO: ask Marko whether vesting tokens can be given only to contributors
    function _mintVesting(address to, uint256 amount) internal virtual {
        _vestingBalance[to] += amount;
        emit VestingSet(to, _vestingBalance[to]);
        _mint(to, amount);
    }

    function _mint(address to, uint256 amount) internal virtual override {
        getNeokingdomToken().mint(address(this), amount);
        super._mint(to, amount);
    }

    // Redefined in GovernanceToken.sol
    //function _wrap(address from, uint amount) internal virtual {
    //    tokenExternal.transferFrom(from, address(this), amount);
    //   super._mint(from, amount);
    //}

    function _unwrap(address from, address to, uint amount) internal virtual {
        require(
            getNeokingdomToken().transfer(to, amount),
            "GovernanceToken: transfer failed"
        );
        super._burn(from, amount);
    }

    function _burn(address from, uint amount) internal virtual override {
        getNeokingdomToken().burn(amount);
        super._burn(from, amount);
    }

    function _setVesting(address account, uint256 amount) internal virtual {
        require(
            amount < _vestingBalance[account],
            "GovernanceToken: vesting can only be decreased"
        );
        emit VestingSet(account, amount);
        _vestingBalance[account] = amount;
    }

    // Tokens that are still in the vesting phase
    function vestingBalanceOf(
        address account
    ) public view virtual returns (uint256) {
        return _vestingBalance[account];
    }
}
