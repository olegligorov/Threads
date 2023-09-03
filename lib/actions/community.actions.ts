"use server"

import { FilterQuery, SortOrder } from "mongoose";

import Community from "../models/community.model";
import Thread from "../models/thread.model";
import User from "../models/user.model";

import { connectToDB } from "../mongoose";

export async function createCommunity(
    id: string,
    name: string,
    username: string,
    image: string,
    bio: string,
    createdById: string
) {
    try {
        connectToDB();

        const user = await User.findOne({ id: createdById });

        if (!user) {
            throw new Error("User not found");
        }

        const newCommunity = new Community({
            id,
            name,
            username,
            image,
            bio,
            createdBy: user._id
        });

        const createdCommunity = await newCommunity.save();

        user.communities.push(createdCommunity._id);
        await user.save();

        return createdCommunity;
    } catch (error: any) {
        throw new Error(`Error while trying to create community, ${error.message}`);
    }
}

export async function fetchCommunityDetails(id: string) {
    try {
        connectToDB();

        const communityDetails = Community.findOne({ id }).
            populate([
                "createdBy",
                {
                    path: "members",
                    model: User,
                    select: "name username image _id id",
                },
            ])

        return communityDetails;

    } catch (error: any) {
        throw new Error(`Error while trying to fetch community data, ${error.message}`);
    }
}

export async function fetchCommunityPosts(id: string) {
    try {
        connectToDB();

        const communityPosts = await Community.findById(id).populate({
            path: "threads",
            model: Thread,
            populate: [
                {
                    path: "author",
                    model: User,
                    select: "name image id", // Select the "name" and "_id" fields from the "User" model
                },
                {
                    path: "children",
                    model: Thread,
                    populate: {
                        path: "author",
                        model: User,
                        select: "image _id", // Select the "name" and "_id" fields from the "User" model
                    },
                },
            ],
        });

        return communityPosts;
    } catch (error: any) {
        throw new Error(`Error while trying to fetch community posts, ${error.message}`);
    }
}

export async function fetchCommunities({
    searchString = "",
    pageNumber = 1,
    pageSize = 20,
    sortBy = "desc",
}: {
    searchString?: string,
    pageNumber?: number,
    pageSize?: number,
    sortBy?: SortOrder,
}) {
    try {
        connectToDB();

        const skipAmount = (pageNumber - 1) * pageSize;

        const regex = new RegExp(searchString, "i");

        const query: FilterQuery<typeof Community> = {};
        if (searchString.trim() !== "") {
            query.$or = [
                { username: { $regex: regex } },
                { name: { $regex: regex } },
            ]
        }

        const sortOptions = { createdAt: sortBy };

        const communitiesQuery = Community.find(query)
            .sort(sortOptions)
            .skip(skipAmount)
            .limit(pageSize)
            .populate("members");

        const totalCommunitiesCount = await Community.countDocuments(query);

        const communities = await communitiesQuery.exec();

        const isNext = totalCommunitiesCount > skipAmount + communities.length;

        return { communities, isNext };
    } catch (error: any) {
        throw new Error(`Error while trying to fetch communites, ${error.message}`);
    }
}

export async function addMemberToCommunity(
    communityId: string,
    memberId: string
) {
    try {
        connectToDB();

        const community = await Community.findOne({ id: communityId });
        if (!community) {
            throw new Error("Community not found");
        }

        const user = await User.findOne({ id: memberId });
        if (!user) {
            throw new Error("User not found");
        }

        if (community.members.includes(user._id)) {
            throw new Error("User is already a member of the community");
        }

        community.members.push(user._id);
        await community.save();

        user.communities.push(community._id);
        await user.save();

        return community;
    } catch (error: any) {
        throw new Error(`Error while adding member to community, ${error.message}`);
    }
}

export async function removeUserFromCommunity(
    communityId: string,
    userId: string
) {
    try {
        connectToDB();

        const userIdObject = await User.findOne({ id: userId }, { _id: 1 });
        const communityIdObject = await Community.findOne(
            { id: communityId },
            { _id: 1 }
        );

        if (!userIdObject) {
            throw new Error("User not found");
        }

        if (!communityIdObject) {
            throw new Error("Community not found");
        }

        await Community.updateOne(
            { _id: communityIdObject._id },
            { $pull: { members: userIdObject._id } }
        );

        await User.updateOne(
            { _id: userIdObject._id },
            { $pull: { communities: communityIdObject._id } }
        );

        return { success: true };

    } catch (error: any) {
        throw new Error(`Error while removing member from community, ${error.message}`);
    }
}

export async function updateCommunityInfo(
    communityId: string,
    name: string,
    username: string,
    image: string
) {
    try {
        connectToDB();

        // Find the community by its _id and update the information
        const updatedCommunity = await Community.findOneAndUpdate(
            { id: communityId },
            { name, username, image }
        );

        if (!updatedCommunity) {
            throw new Error("Community not found");
        }

        return updatedCommunity;
    } catch (error) {
        // Handle any errors
        console.error("Error updating community information:", error);
        throw error;
    }
}

export async function deleteCommunity(communityId: string) {
    try {
        connectToDB();

        // Find the community by its ID and delete it
        const deletedCommunity = await Community.findOneAndDelete({
            id: communityId,
        });

        if (!deletedCommunity) {
            throw new Error("Community not found");
        }

        // Delete all threads associated with the community
        await Thread.deleteMany({ community: communityId });

        // Find all users who are part of the community
        const communityUsers = await User.find({ communities: communityId });

        // Remove the community from the 'communities' array for each user
        const updateUserPromises = communityUsers.map((user) => {
            user.communities.pull(communityId);
            return user.save();
        });

        await Promise.all(updateUserPromises);

        return deletedCommunity;
    } catch (error) {
        console.error("Error deleting community: ", error);
        throw error;
    }
}