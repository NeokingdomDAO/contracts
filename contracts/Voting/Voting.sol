// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";
import "./VotingSnapshot.sol";

/**
 * @title Voting
 * @notice The smart contract handles voting power delegation and manages voting snapshots.
 */
contract Voting is VotingSnapshot {
    /**
     * @notice Initializes the contract with given DAO roles.
     * @param daoRegistry Instance of a DAORoles contract.
     */
    function initialize(DAORegistry daoRegistry) public initializer {
        __DAORegistryProxy_init(daoRegistry);
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {}

    // Snapshottable

    /**
     * @notice Creates a snapshot of the voting state.
     * @return The id of the created snapshot.
     */
    function snapshot()
        public
        virtual
        override
        onlyResolutionManager
        returns (uint256)
    {
        return _snapshot();
    }

    // Hooks

    /**
     * @notice Hook called on every governance token transfer.
     * @dev Called by GovernanceToken and ShareholderRegistry.
     * @param from The sender's address.
     * @param to The receiver's address.
     * @param amount The amount transferred.
     */
    function afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) external virtual override onlyGovernanceToken {
        _afterTokenTransfer(from, to, amount);
    }

    /**
     * @notice Hook called before removing a contributor.
     * @param account The address of the contributor to be removed.
     */
    function beforeRemoveContributor(
        address account
    ) external virtual override onlyShareholderRegistry {
        _beforeRemoveContributor(account);
    }

    /**
     * @notice Hook called after adding a contributor.
     * @param account The address of the newly added contributor.
     */
    function afterAddContributor(
        address account
    ) external virtual override onlyShareholderRegistry {
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
    ) public virtual override onlyResolutionManager {
        _delegate(delegator, newDelegate);
    }
}
