// SPDX-License-Identifier: MIT

pragma solidity 0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";
import "../NeokingdomToken/INeokingdomToken.sol";
import "../GovernanceToken/IGovernanceToken.sol";
import "../ShareholderRegistry/IShareholderRegistry.sol";
import "../Voting/IVoting.sol";
import "../RedemptionController/IRedemptionController.sol";
import "../ResolutionManager/IResolutionManager.sol";
import "../InternalMarket/InternalMarket.sol";

contract DAORegistry is Ownable {
    INeokingdomToken internal _neokingdomToken;
    IGovernanceToken internal _governanceToken;
    IShareholderRegistry internal _shareholderRegistry;
    IVoting internal _voting;
    IRedemptionController internal _redemptionController;
    IResolutionManager internal _resolutionManager;
    InternalMarket internal _internalMarket;

    function setNeokingdomToken(INeokingdomToken neokingdomToken) public owner {
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

    function setGovernanceToken(IGovernanceToken governanceToken) public owner {
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
    ) public owner {
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

    function setVoting(IVoting voting) public owner {
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
    ) public owner {
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
        IResolutionManager resolutionManager
    ) public owner {
        _resolutionManager = resolutionManager;
    }

    function getResolutionManager() public view returns (IResolutionManager) {
        return _resolutionManager;
    }

    function requireMsgSenderToBeResolutionManager() public view {
        address account = _msgSender();
        require(
            account == address(_resolutionManager),
            "DAORoles: sender is not ResolutionManager"
        );
    }

    function setInternalMarket(InternalMarket internalMarket) public owner {
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
