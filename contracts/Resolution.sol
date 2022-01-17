// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IERC20Mintable is IERC20 {
    function mint(address, uint256) external;
}


contract ShareholdersRegistry {
    mapping(address => bool) public shareholders;
}

abstract contract Delegation {
    mapping(address=>address) public delegateTo;
    mapping(address=>address[]) public delegateFrom;


    function snapshot() external virtual returns (uint);
    
    function getDelegatedAt(address, uint256) external virtual returns (address);
    function getDelegatorsAt(address, uint256) external virtual returns (address[] memory);
    function getVotingPowerAt(address, uint256) external virtual returns (uint256);

    function getDelegated(address) external virtual returns (address);
    function getDelegators(address) external virtual returns (address[] memory);
    function getVotingPower(address) external virtual returns (uint256);

    function delegate(address delegated) external {
        delegateTo[msg.sender] = delegated;
        delegateFrom[delegated].push(msg.sender);
    }
}

// TODO:
// - support resolutions with transfer of existing TT from DAO to addresses
// - support resolutions with transfer of DAI from DAO to addresses

contract Resolution {
    Delegation delegation;
    address dao;

    struct ResolutionType {
        uint256 quorum;
        uint256 noticePeriod;
        uint256 votingPeriod;
    }

    struct ResolutionContent {
        uint256 resolutionType;
        uint256 snapshotId;
        bytes32 contentHash;
        uint256 timestamp;
        uint256 totalVotingTokens;
        address forbiddenVoter;
        address[] yesVoters;
        address[] noVoters;
        mapping(address => uint256) preference;
        Payout payout;
        // Derived:
        uint256 yes;
        uint256 no;
    }

    struct Payout {
        address[] receivers;
        uint256[] amounts;
        IERC20Mintable token;
        bool mint;
    }

    event Voted(
        uint256 indexed resolutionId,
        address shareholder,
        bool choice,
        uint256 share
    );

    modifier onlyValidContributor() {
        // check if shareholder
        // check if at least 1 token
        // check if contributor not forbidden (for instance because they are a subject of the resolution)
        _;
    }

    modifier onlyAdmin() {
        _;
    }

    modifier isVotingActive(uint256 resolutionId) {
        // the resolution is within the voting time window
        _;
    }

    mapping(uint256 => ResolutionContent) public resolutions;
    ResolutionType[6] public resolutionTypes = [
        // Fundamental
        ResolutionType(67, 14 days, 6 days),
        // Routine
        ResolutionType(51, 3 days, 2 days)
    ];

    // contentHash contains the e-card digital signature
    // QUESTION: arrays in method interfaces need to be bounded. Can we assume a maximum length for the ones given below?
    function createDraft(
        uint256 resolutionType,
        bytes32 contentHash,
        address forbiddenVoters,
        Payout memory payout
    ) public onlyAdmin returns (uint256 draftId) {}

    function getResolution(uint256 resolutionId) public view {
        // Returns details about the resolution and the state:
        // - notice period
        // - voting period
        // - end yes
        // - end no
        // - no quorum reached

        ResolutionContent storage resolution = resolutions[resolutionId];
        ResolutionType memory resolutionType = resolutionTypes[
            resolution.resolutionType
        ];

        string memory state;

        if (
            block.timestamp < resolution.timestamp + resolutionType.noticePeriod
        ) {
            state = "notice period";
        } else if (
            block.timestamp <
            resolution.timestamp +
                resolutionType.noticePeriod +
                resolutionType.votingPeriod
        ) {
            state = "voting period";
        } else {
            state = "ended";
        }

        uint256 yes;
        uint256 no;

        for (uint256 i = 0; i < resolution.yesVoters.length; i++) {
            address voter = resolution.yesVoters[i];
            yes += resolution.preference[voter];
        }

        for (uint256 i = 0; i < resolution.noVoters.length; i++) {
            address voter = resolution.noVoters[i];
            no += resolution.preference[voter];
        }

        // uint quorum = yes / resolution.totalVotingTokens;
        uint256 absoluteQuorum = resolutionType.quorum *
            resolution.totalVotingTokens;
        if (yes * 100 >= absoluteQuorum) {}
    }

    function vote(uint256 resolutionId, bool yes)
        public
        isVotingActive(resolutionId)
        onlyValidContributor
    {
        // if already voted, remove old vote
        // append sender to right voters list
        // update total votes count
        // store preference

        ResolutionContent storage resolution = resolutions[resolutionId];

        uint256 votingPower = delegation.getVotingPower(msg.sender);

        // getDelegators return only delegators that haven't voted in the meantime
        // TODO: if you delegated someone and this someone already voted, we also have to remove the vote that that someone already put for us
        address[] memory voters = delegation.getDelegators(msg.sender);

        if (votingPower > 0) {
            // if inside yesVoters, remove all delegators in yesVoters
            // if inside noVoters, remove all delegators in noVoters
        } else {
            resolution.totalVotingTokens += votingPower;
        }

        for(uint i = 0; i < voters.length; i++) {
            if (yes) {
                resolution.yesVoters.push(voters[i]);
            } else {
                resolution.noVoters.push(voters[i]);
            }
        }

        resolution.preference[msg.sender] = votingPower;
    }

    function executeResolution(uint256 resolutionId) public onlyAdmin {
        // for each receiver in the resolution, send the specified amount of tokens to them
        Payout storage payout = resolutions[resolutionId].payout;
        // test
        if(payout.mint) {
            for (uint256 i = 0; i < payout.receivers.length; i++) {
                payout.token.mint(payout.receivers[i], payout.amounts[i]);
            }
        }
        else {
            for (uint256 i = 0; i < payout.receivers.length; i++) {
                payout.token.transferFrom(dao, payout.receivers[i], payout.amounts[i]);
            }
        }
    }
}
