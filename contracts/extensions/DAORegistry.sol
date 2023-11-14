// SPDX-License-Identifier: MIT

pragma solidity 0.8.16;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "../NeokingdomToken/INeokingdomToken.sol";
import "../GovernanceToken/IGovernanceToken.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";
import "../Voting/IVoting.sol";
import "../RedemptionController/IRedemptionController.sol";
import "../ResolutionManager/ResolutionManager.sol";
import "../InternalMarket/InternalMarket.sol";

contract DAORegistry is AccessControl {
    INeokingdomToken internal _neokingdomToken;
    IGovernanceToken internal _governanceToken;
    IShareholderRegistry internal _shareholderRegistry;
    IVoting internal _voting;
    IRedemptionController internal _redemptionController;
    ResolutionManager internal _resolutionManager;
    InternalMarket internal _internalMarket;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
    }

    /*
    function initialize() {

    }
    */

    function setNeokingdomToken(
        INeokingdomToken neokingdomToken
    ) public onlyRole(Roles.OPERATOR_ROLE) {
        _neokingdomToken = neokingdomToken;
    }

    function getNeokingdomToken() public view returns (INeokingdomToken) {
        return _neokingdomToken;
    }

    function requireMsgSenderToBeNeokingdomToken() public view {
        address account = _msgSender();
        require(
            account == address(_neokingdomToken),
            "DAORoles: sender is not NeokingdomToken"
        );
    }

    function setGovernanceToken(
        IGovernanceToken governanceToken
    ) public onlyRole(Roles.OPERATOR_ROLE) {
        _governanceToken = governanceToken;
    }

    function getGovernanceToken() public view returns (IGovernanceToken) {
        return _governanceToken;
    }

    function requireMsgSenderToBeGovernanceToken() public view {
        address account = _msgSender();
        require(
            account == address(_governanceToken),
            "DAORoles: sender is not GovernanceToken"
        );
    }

    function setShareholderRegistry(
        IShareholderRegistry shareholderRegistry
    ) public onlyRole(Roles.OPERATOR_ROLE) {
        _shareholderRegistry = shareholderRegistry;
    }

    function getShareholderRegistry()
        public
        view
        returns (IShareholderRegistry)
    {
        return _shareholderRegistry;
    }

    function requireMsgSenderToBeShareholderRegistry() public view {
        address account = _msgSender();
        require(
            account == address(_shareholderRegistry),
            "DAORoles: sender is not ShareholderRegistry"
        );
    }

    function setVoting(IVoting voting) public onlyRole(Roles.OPERATOR_ROLE) {
        _voting = voting;
    }

    function getVoting() public view returns (IVoting) {
        return _voting;
    }

    function requireMsgSenderToBeVoting() public view {
        address account = _msgSender();
        require(account == address(_voting), "DAORoles: sender is not Voting");
    }

    function setRedemptionController(
        IRedemptionController redemptionController
    ) public onlyRole(Roles.OPERATOR_ROLE) {
        _redemptionController = redemptionController;
    }

    function getRedemptionController()
        public
        view
        returns (IRedemptionController)
    {
        return _redemptionController;
    }

    function requireMsgSenderToBeRedemptionController() public view {
        address account = _msgSender();
        require(
            account == address(_redemptionController),
            "DAORoles: sender is not RedemptionController"
        );
    }

    function setResolutionManager(
        ResolutionManager resolutionManager
    ) public onlyRole(Roles.OPERATOR_ROLE) {
        _resolutionManager = resolutionManager;
    }

    function getResolutionManager() public view returns (ResolutionManager) {
        return _resolutionManager;
    }

    function requireMsgSenderToBeResolutionManager() public view {
        address account = _msgSender();
        require(
            account == address(_resolutionManager),
            "DAORoles: sender is not ResolutionManager"
        );
    }

    function setInternalMarket(
        InternalMarket internalMarket
    ) public onlyRole(Roles.OPERATOR_ROLE) {
        _internalMarket = internalMarket;
    }

    function getInternalMarket() public view returns (InternalMarket) {
        return _internalMarket;
    }

    function requireMsgSenderToBeInternalMarket() public view {
        address account = _msgSender();
        require(
            account == address(_internalMarket),
            "DAORoles: sender is not InternalMarket"
        );
    }
}
