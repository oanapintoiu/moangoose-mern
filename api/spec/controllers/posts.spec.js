const app = require("../../app");
const request = require("supertest");
require("../mongodb_helper");
const Post = require('../../models/post');
const User = require('../../models/user');
const JWT = require("jsonwebtoken");
const secret = process.env.JWT_SECRET;
const mongoose = require('mongoose');

let token;
let user;

describe("/posts", () => {
  beforeAll( async () => {
    user = new User({email: "test@test.com", password: "12345678",  firstName: "Betty",
    lastName: "Rubble" }); // Assign the created user to the user variable
    await user.save();

    token = JWT.sign({
      user_id: user.id,
      // Backdate this token of 5 minutes
      iat: Math.floor(Date.now() / 1000) - (5 * 60),
      // Set the JWT token to expire in 10 minutes
      exp: Math.floor(Date.now() / 1000) + (10 * 60)
    }, secret);
  });

  beforeEach( async () => {
    await Post.deleteMany({});
  })

  afterAll( async () => {
    await User.deleteMany({});
    await Post.deleteMany({});
  })

  describe("POST, when token is present", () => {
    test("responds with a 201", async () => {
      let response = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({ message: "hello world", like: 0, token: token });
      expect(response.status).toEqual(201);
    });
  
    test("creates a new post", async () => {
      await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({ message: "hello world", token: token });
      let posts = await Post.find();
      expect(posts.length).toEqual(1);
      expect(posts[0].message).toEqual("hello world");
    });

    test("creates a new post", async () => {
      await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({ message: "hello world", token: token });
      let posts = await Post.find();
      expect(posts.length).toEqual(1);
      expect(posts[0].like).toEqual(0);
    });
  
    test("returns a new token", async () => {
      let response = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({ message: "hello world", token: token })
      let newPayload = JWT.decode(response.body.token, process.env.JWT_SECRET);
      let originalPayload = JWT.decode(token, process.env.JWT_SECRET);
      expect(newPayload.iat > originalPayload.iat).toEqual(true);
    });  
  });
  
  describe("POST, when token is missing", () => {
    test("responds with a 401", async () => {
      let response = await request(app)
        .post("/posts")
        .send({ message: "hello again world" });
      expect(response.status).toEqual(401);
    });
  
    test("a post is not created", async () => {
      await request(app)
        .post("/posts")
        .send({ message: "hello again world" });
      let posts = await Post.find();
      expect(posts.length).toEqual(0);
    });
  
    test("a token is not returned", async () => {
      let response = await request(app)
        .post("/posts")
        .send({ message: "hello again world" });
      expect(response.body.token).toEqual(undefined);
    });
  })

  describe("GET, when token is present", () => {
    test("returns every post in the collection", async () => {
      let post1 = new Post({message: "howdy!"});
      let post2 = new Post({message: "hola!"});
      await post1.save();
      await post2.save();
      let response = await request(app)
        .get("/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({token: token});
      let messages = response.body.posts.map((post) => ( post.message ));
      expect(messages).toEqual(["hola!", "howdy!"]);
    })

    test("the response code is 200", async () => {
      let post1 = new Post({message: "howdy!"});
      let post2 = new Post({message: "hola!"});
      await post1.save();
      await post2.save();
      let response = await request(app)
        .get("/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({token: token});
      expect(response.status).toEqual(200);
    })

    test("returns a new token", async () => {
      let post1 = new Post({message: "howdy!"});
      let post2 = new Post({message: "hola!"});
      await post1.save();
      await post2.save();
      let response = await request(app)
        .get("/posts")
        .set("Authorization", `Bearer ${token}`)
        .send({token: token});
      let newPayload = JWT.decode(response.body.token, process.env.JWT_SECRET);
      let originalPayload = JWT.decode(token, process.env.JWT_SECRET);
      expect(newPayload.iat > originalPayload.iat).toEqual(true);
    })
  })

  describe("GET, when token is missing", () => {
    test("returns no posts", async () => {
      let post1 = new Post({message: "howdy!"});
      let post2 = new Post({message: "hola!"});
      await post1.save();
      await post2.save();
      let response = await request(app)
        .get("/posts");
      expect(response.body.posts).toEqual(undefined);
    })

    test("the response code is 401", async () => {
      let post1 = new Post({message: "howdy!"});
      let post2 = new Post({message: "hola!"});
      await post1.save();
      await post2.save();
      let response = await request(app)
        .get("/posts");
      expect(response.status).toEqual(401);
    })

    test("does not return a new token", async () => {
      let post1 = new Post({message: "howdy!"});
      let post2 = new Post({message: "hola!"});
      await post1.save();
      await post2.save();
      let response = await request(app)
        .get("/posts");
      expect(response.body.token).toEqual(undefined);
    })
  })

  describe("POST /posts/:id/likes", () => {
    test("increases the number of likes for a post by 1", async () => {
        let post1 = new Post({message: "howdy!"});
        await post1.save();

        let response = await request(app)
            .post(`/posts/${post1._id}/likes`)
            .set("Authorization", `Bearer ${token}`)
            .send({ token: token });

        expect(response.status).toEqual(201);
        expect(response.body.post.like).toEqual(1);

        let updatedPost = await Post.findById(post1._id);
        expect(updatedPost.like).toEqual(1);
    });

    test("returns error message when user has already liked the post", async () => {
        let post1 = new Post({message: "howdy!"});
        await post1.save();

        // User likes the post for the first time
        await request(app)
            .post(`/posts/${post1._id}/likes`)
            .set("Authorization", `Bearer ${token}`)
            .send({ token: token });

        // User tries to like the post a second time
        let response = await request(app)
            .post(`/posts/${post1._id}/likes`)
            .set("Authorization", `Bearer ${token}`)
            .send({ token: token });

        expect(response.status).toEqual(400);
        expect(response.body.message).toEqual("You've already liked this post.");
    });

    test("returns an error when trying to like a non-existing post", async () => {
      let nonExistingPostId = "5d9f1140f10a81216cfd4408";  // a non-existing ObjectId

      let response = await request(app)
          .post(`/posts/${nonExistingPostId}/likes`)
          .set("Authorization", `Bearer ${token}`)
          .send({ token: token });

      expect(response.status).toEqual(404);
      expect(response.body.message).toEqual("Post not found");
    });
  });

  describe("POST /posts/:id/comments", () => {
    test("adds a comment to a post and checks author", async () => {
      let post1 = new Post({message: "howdy!"});
      await post1.save();
  
      const user = await User.findOne({email: "test@test.com"});
  
      await request(app)
        .post(`/posts/${post1._id}/comments`)
        .set("Authorization", `Bearer ${token}`)
        .send({ 
          comment: "This is a test comment", 
          author: { id: user._id.toString(), name: `${user.firstName} ${user.lastName}` } 
        })
        .expect(201);
  
      let updatedPost = await Post.findById(post1._id);
      expect(updatedPost.comments.length).toEqual(1);
      expect(updatedPost.comments[0]).toMatchObject({ 
        comment: "This is a test comment", 
        author: { id: user._id.toString(), name: `${user.firstName} ${user.lastName}` } 
      });
    });
  });

  describe("DELETE /posts/:id/likes", () => {
    test("decreases the number of likes for a post by 1", async () => {
      let post1 = new Post({message: "howdy!", like: 1, likedBy: [user._id]});
      await post1.save();
  
      let response = await request(app)
        .delete(`/posts/${post1._id}/likes`)
        .set("Authorization", `Bearer ${token}`)
        .send({ token: token });
  
      expect(response.status).toEqual(201);
      expect(response.body.post.like).toEqual(0);
  
      let updatedPost = await Post.findById(post1._id);
      expect(updatedPost.like).toEqual(0);
    });
  });

  describe("POST, with non-existing user", () => {
    test("responds with a 404 and User not found message", async () => {
      // Generate a random ObjectId which is not present in database
      let randomUserId = new mongoose.Types.ObjectId();
  
      // Create a new JWT with this user id
      let nonExistingUserToken = JWT.sign({
        user_id: randomUserId,
        // Backdate this token of 5 minutes
        iat: Math.floor(Date.now() / 1000) - (5 * 60),
        // Set the JWT token to expire in 10 minutes
        exp: Math.floor(Date.now() / 1000) + (10 * 60)
      }, secret);
  
      let response = await request(app)
        .post("/posts")
        .set("Authorization", `Bearer ${nonExistingUserToken}`)
        .send({ message: "hello world", token: nonExistingUserToken });
  
      expect(response.status).toEqual(404);
      expect(response.body.message).toEqual('User not found');
    });
  });
  
});  
