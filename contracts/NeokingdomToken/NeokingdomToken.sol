// SPDX-License-Identifier: MIT

pragma solidity ^0.8.16;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./NeokingdomTokenSnapshot.sol";
import { Roles } from "../extensions/Roles.sol";
import "../extensions/DAORoles.sol";
import "../extensions/HasRole.sol";

contract NeokingdomToken is Initializable, HasRole, NeokingdomTokenSnapshot {
    function initialize(
        DAORoles roles,
        string memory name,
        string memory symbol
    ) public initializer {
        _initialize(name, symbol);
        _setRoles(roles);
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    function snapshot()
        public
        virtual
        override
        onlyRole(Roles.RESOLUTION_ROLE)
        returns (uint256)
    {
        return _snapshot();
    }

    function setVoting(
        IVoting voting
    ) external virtual onlyRole(Roles.OPERATOR_ROLE) {
        _setVoting(voting);
    }

    function setInternalMarket(
        InternalMarket internalMarket
    ) external virtual onlyRole(Roles.OPERATOR_ROLE) {
        _setInternalMarket(internalMarket);
    }

    function setRedemptionController(
        IRedemptionController redemption
    ) external virtual onlyRole(Roles.OPERATOR_ROLE) {
        _setRedemptionController(redemption);
    }

    function mint(
        address to,
        uint256 amount
    ) public virtual onlyRole(Roles.MINTER_ROLE) {
        _mint(to, amount);
    }

    function mintVesting(
        address to,
        uint256 amount
    ) public virtual onlyRole(Roles.RESOLUTION_ROLE) {
        _mintVesting(to, amount);
    }

    function setVesting(
        address to,
        uint256 amount
    ) public virtual onlyRole(Roles.OPERATOR_ROLE) {
        _setVesting(to, amount);
    }

    function burn(address account, uint256 amount) public virtual {
        super._burn(account, amount);
    }
}
