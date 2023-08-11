// SPDX-License-Identifier: MIT
pragma solidity ^0.8.16;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";
import "./VotingSnapshot.sol";
import { Roles } from "../extensions/Roles.sol";
import "../extensions/DAORoles.sol";
import "../extensions/HasRole.sol";

/**
 * @title Voting
 * @notice The smart contract handles voting power delegation and manages voting snapshots.
 */
contract Voting is VotingSnapshot, Initializable, HasRole {
    /**
     * @notice Initializes the contract with given DAO roles.
     * @param roles Instance of a DAORoles contract.
     */
    function initialize(DAORoles roles) public initializer {
        _setRoles(roles);
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    /**
     * @dev Modifier that restricts access to only the token contract.
     */
    modifier onlyToken() virtual {
        require(
            msg.sender == address(_token) ||
                msg.sender == address(_shareholderRegistry),
            "Voting: only Token contract can call this method."
        );
        _;
    }

    modifier zeroCheck(address address_) {
        require(address_ != address(0), "Voting: 0x0 not allowed");
        _;
    }

    // Dependencies

    /**
     * @notice Sets the token contract address.
     * @param token Address of the token contract.
     */
    function setToken(
        IERC20Upgradeable token
    )
        external
        virtual
        override
        onlyRole(Roles.OPERATOR_ROLE)
        zeroCheck(address(token))
    {
        super._setToken(token);
    }

    /**
     * @notice Sets the shareholder registry contract address.
     * @param shareholderRegistry Address of the shareholder registry contract.
     */
    function setShareholderRegistry(
        IShareholderRegistry shareholderRegistry
    )
        external
        virtual
        override
        onlyRole(Roles.OPERATOR_ROLE)
        zeroCheck(address(shareholderRegistry))
    {
        _setShareholderRegistry(shareholderRegistry);
    }

    // Snapshottable

    /**
     * @notice Creates a snapshot of the voting state.
     * @return The id of the created snapshot.
     */
    function snapshot()
        public
        virtual
        override
        onlyRole(Roles.RESOLUTION_ROLE)
        returns (uint256)
    {
        return _snapshot();
    }

    // Hooks

    /**
     * @notice Hook called on every governance token transfer.
     * @dev Only the governance token can call this method.
     * @param from The sender's address.
     * @param to The receiver's address.
     * @param amount The amount transferred.
     */
    function afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) external virtual override onlyToken {
        _afterTokenTransfer(from, to, amount);
    }

    /**
     * @notice Hook called before removing a contributor.
     * @param account The address of the contributor to be removed.
     */
    function beforeRemoveContributor(
        address account
    ) external virtual override onlyRole(Roles.SHAREHOLDER_REGISTRY_ROLE) {
        _beforeRemoveContributor(account);
    }

    /**
     * @notice Hook called after adding a contributor.
     * @param account The address of the newly added contributor.
     */
    function afterAddContributor(
        address account
    ) external virtual override onlyRole(Roles.SHAREHOLDER_REGISTRY_ROLE) {
        _afterAddContributor(account);
    }

    // Public

    /**
     *  @notice Allows the caller to delegate their voting power to another address.
     *  @dev The first address to be delegated must be the sender itself.
     *  @param newDelegate The address to delegate voting power to.
     */
    function delegate(address newDelegate) public virtual override {
        _delegate(msg.sender, newDelegate);
    }

    /**
     * @notice Allows a sender to delegate another address for voting on behalf of a delegator.
     * @dev Sub-delegation is not allowed.
     * @param delegator The address delegating their voting power.
     * @param newDelegate The address to delegate voting power to.
     */
    function delegateFrom(
        address delegator,
        address newDelegate
    ) public virtual override onlyRole(Roles.RESOLUTION_ROLE) {
        _delegate(delegator, newDelegate);
    }
}
