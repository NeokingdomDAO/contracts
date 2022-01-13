// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract ShareholdersRegistry {
    mapping(address => bool) public shareholders;
}

/* ERC-20 + snapshot */
abstract contract TelediskoToken is ERC20Snapshot, ERC20PresetMinterPauser {
    uint256 public totalVotingTokens;

    function _beforeTokenTransfer(address from, address to, uint256 amount) override(ERC20PresetMinterPauser, ERC20Snapshot) internal {}
}

contract Resolution {
    TelediskoToken private token;


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
        address[] forbiddenVoters;
        address[] yesVoters;
        address[] noVoters;
        mapping(address => uint256) preference;
        Transaction transaction;
        // Derived:
        uint256 yes;
        uint256 no;
    }

    struct Transaction {
        uint256[] amounts;
        address[] receivers;
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

    modifier isVotingActive() {
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
    function createDraft(uint256 resolutionType, bytes32 contentHash, address[5] memory forbiddenVoters, uint256[100] memory amounts, uint256[100] memory receivers)
        public onlyAdmin
        returns (uint256 draftId)
    {}

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


    function vote(uint256 resolutionId, bool yes) public isVotingActive onlyValidContributor {
        // if already voted, remove old vote
        // append sender to right voters list
        // update total votes count
        // store preference

        ResolutionContent storage resolution = resolutions[resolutionId];
        uint256 votingTokens = resolution.preference[msg.sender];
        if(votingTokens > 0) {
            // if inside yesVoters, remove
            // if inside noVoters, remove
        }
        else { 
            resolution.totalVotingTokens += votingTokens;
        }
        
        if(yes) {
            resolution.yesVoters.push(msg.sender);
        }
        else {
            resolution.noVoters.push(msg.sender);
        }

        resolution.preference[msg.sender] = votingTokens;
    }

    function executeResolution(uint resolutionId) public onlyAdmin {
        // for each receiver in the resolution, send the specified amount of tokens to them
        Transaction storage transaction = resolutions[resolutionId].transaction;

        for(uint i = 0; i < transaction.receivers.length; i++) {
            token.mint(transaction.receivers[i], transaction.amounts[i]); 
        }
    }
}
