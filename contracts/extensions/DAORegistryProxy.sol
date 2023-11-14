// SPDX-License-Identifier: MIT

pragma solidity 0.8.16;

import "./DAORegistry.sol";
import "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract DAORegistryProxy is ContextUpgradeable {
    DAORegistry internal _daoRegistry;

    function __DAORegistryProxy_init(DAORegistry daoRegistry) internal {
        require(
            address(daoRegistry) != address(0),
            "DAORegistryProxy: 0x0 not allowed"
        );
        _daoRegistry = daoRegistry;
    }

    function getDAORegistry() public view returns (DAORegistry) {
        return _daoRegistry;
    }

    // Neokingdom Token contract

    function getNeokingdomToken() public view returns (INeokingdomToken) {
        return _daoRegistry.getNeokingdomToken();
    }

    modifier onlyNeokingdomToken() {
        _daoRegistry.requireMsgSenderToBeNeokingdomToken();
        _;
    }

    // Governance Token contract

    function getGovernanceToken() public view returns (IGovernanceToken) {
        return _daoRegistry.getGovernanceToken();
    }

    modifier onlyGovernanceToken() {
        _daoRegistry.requireMsgSenderToBeGovernanceToken();
        _;
    }

    // Shareholders' Registry contract

    function getShareholderRegistry()
        public
        view
        returns (IShareholderRegistry)
    {
        return _daoRegistry.getShareholderRegistry();
    }

    modifier onlyShareholderRegistry() {
        _daoRegistry.requireMsgSenderToBeShareholderRegistry();
        _;
    }

    // Voting contract

    function getVoting() public view returns (IVoting) {
        return _daoRegistry.getVoting();
    }

    modifier onlyVoting() {
        _daoRegistry.requireMsgSenderToBeVoting();
        _;
    }

    // Redemption Controller contract

    function getRedemptionController()
        public
        view
        returns (IRedemptionController)
    {
        return _daoRegistry.getRedemptionController();
    }

    modifier onlyRedemptionController() {
        _daoRegistry.requireMsgSenderToBeRedemptionController();
        _;
    }

    // Resolution Manager contract

    function getResolutionManager() public view returns (IResolutionManager) {
        return _daoRegistry.getResolutionManager();
    }

    modifier onlyResolutionManager() {
        _daoRegistry.requireMsgSenderToBeResolutionManager();
        _;
    }

    // Internal Market contract

    function getInternalMarket() public view returns (InternalMarket) {
        return _daoRegistry.getInternalMarket();
    }

    modifier onlyInternalMarket() {
        _daoRegistry.requireMsgSenderToBeInternalMarket();
        _;
    }
}
