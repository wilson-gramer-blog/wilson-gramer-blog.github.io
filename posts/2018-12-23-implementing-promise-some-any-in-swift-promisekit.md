---
title: Implementing Promise.some/any in Swift PromiseKit
postDate: December 23, 2018
---

[PromiseKit](https://github.com/mxcl/PromiseKit) is a popular library for Swift programs that helps make asynchronous code more readable. Essentially it works like this:

```swift 
firstly {
    makeNetworkRequest()
}.then {
    downloadUserProfile()
}.then { profile in
    logInUser(userProfile: profile)
}.ensure {
    updateUI() // always runs
}.catch { error in
    handleError(error)
}
```

...where each function returns a “promise” — a type that can either “fulfill” with a value or “reject” with an error. When a promise in the chain rejects, the catch function is called as shown above and the chain halts.

One other useful thing PromiseKit provides is the ability to run multiple promises concurrently and return an array of all the values fulfilled. It works by using the `when` function:

```swift 
when(fulfilled: downloadA(), downloadB()).then { a, b in
    doStuff(with: a, and: b)
}.catch { error in
    handleError(error)
}
```

...if any of the promises reject, then the `catch` function is called.

However, what if we want to apply a task to many inputs and run them all concurrently, independent of each other’s error status? JavaScript’s [bluebird.js](http://bluebirdjs.com/docs/api/promise.some.html) library offers the feature we want through `Promise.some`, where the number of promises specified are executed regardless if some of them reject. If all of them reject, then the `catch` function is called. Behavior like this is useful in situations where, for example, you need to send a notification to a group of users (eg. in a group chat) and don’t want a single user’s error to prevent the other users from receiving the notification.

So how can we implement this in PromiseKit? Essentially, I copied the code from PromiseKit’s `when` function, which combines all the promises into a single promise, and modified it to return a `Maybe` type (like in Google’s [Promises](https://github.com/google/promises) library), instead of rejecting the aggregate promise. The aggregate promise is only rejected with an `AllPromisesFailedError` if all the promises reject.

Here’s my implementation below for easy copy/pasting; I’ll walk you through how it works next:

```swift 
enum Maybe<Value> {
    
    case value(Value)
    case error(Error)
    
    init(_ value: Value) {
        self = .value(value)
    }
    
    init(_ error: Error) {
        self = .error(error)
    }
    
    var value: Value? {
        if case .value(let value) = self {
            return value
        } else {
            return nil
        }
    }
    
    var error: Error? {
        if case .error(let error) = self {
            return error
        } else {
            return nil
        }
    }
    
    var isSuccess: Bool {
        if case .value = self {
            return true
        } else {
            return false
        }
    }
    
    var isError: Bool {
        return !self.isSuccess
    }
}

struct AllPromisesFailedError<T>: Error {
    var promises: [Promise<T>]
}

// MARK: `any` function
func any<T>(_ promises: [Promise<T>]) -> Promise<[Maybe<T>]> {
    guard promises.count > 0 else {
        return .value([])
    }
    
    let (finalPromise, finalResolver) = Promise<[Maybe<T>]>.pending()
    
    let barrier = DispatchQueue(label: "org.promisekit.barrier.any", attributes: .concurrent)
    
    var allValues = [Maybe<T>]()
    var errorCount = 0
    
    // Run each promise and convert its result into a Maybe
    for promise in promises {
        promise.pipe { result in
            barrier.sync(flags: .barrier) {
                guard finalPromise.isPending else { return }
                
                switch result {
                case .rejected(let error):
                    allValues.append(Maybe<T>(error))
                    errorCount += 1
                case .fulfilled(let value):
                    allValues.append(Maybe<T>(value))
                }
            }
        }
    }
    
    if errorCount == promises.count {
        // Everything failed; reject the whole promise
        finalResolver.reject(AllPromisesFailedError(promises: promises))
    } else {
        finalResolver.fulfill(allValues)
    }
    
    return finalPromise
}
```

## The Implementation 

To start, I define a `Maybe` enum like that found in Google’s Promises library. It lets you pass a value or an error, but not both.

Next, I define a simple `AllPromisesFailedError` that accepts an array of all the original (ie. pending) promises, which could be useful for debugging if one loses access to the original promises otherwise.

Now for the actual `any` function (I decided to name it this over `some`). Let’s take a look:

```swift 
guard promises.count > 0 else {
    return .value([])
}
```

This guard simply checks to make sure that promises are actually passed. Otherwise, it returns a promise pre-fulfilled with an empty array since no extra work is needed.

```swift 
let (finalPromise, finalResolver) = Promise<[Maybe<T>]>.pending()
```

Here we create the aggregate promise and its resolver in a pending state, which means that we don’t have to provide a closure for it right away; instead we can resolve/reject it later on without escaping the current scope.

```swift 
let barrier = DispatchQueue(label: "org.promisekit.barrier.any", attributes: .concurrent)
```

Next, we create a `DispatchQueue` for this aggregate promise, so it doesn’t block any other threads in the app. I copy/pasted this directly from the `when` function and simply renamed the queue’s name from `when` to `any` so no conflicts arise.

```swift
var allValues = [Maybe<T>]()
var errorCount = 0
```

These variables will keep track of all of the `Maybe`s and count how many promises reject.

```swift 
for promise in promises {
    promise.pipe { result in
        barrier.sync(flags: .barrier) {
```

Now we can begin iterating over the promises, executing each one and capturing its result.

```swift
guard finalPromise.isPending else { return }

switch result {
case .rejected(let error):
    allValues.append(Maybe<T>(error))
    errorCount += 1
case .fulfilled(let value):
    allValues.append(Maybe<T>(value))
}
```

For each promise, we first check that the aggregate promise is still pending (which it should be). Then, we check the promise’s result: if it’s rejected with an error, we increase the error count and wrap the error in a `Maybe.error`; if it’s fulfilled, we wrap the value in a `Maybe.value`. Either way, the promise’s result gets converted to a `Maybe` type which the developer can access later.

```swift 
if errorCount == promises.count {
    // Everything failed; reject the whole promise
    finalResolver.reject(AllPromisesFailedError(promises: promises))
} else {
    finalResolver.fulfill(allValues)
}

return finalPromise
```

Now that all of the promises have been executed and their values converted, we can return the final aggregate promise. Before we do, we fulfill or reject the promise accordingly: if all the promises failed, we reject with an `AllPromisesFailedError`; otherwise, we return all of the `Maybe`s. Since they were stored in an array that was filled by essentially “mapping” over each promise, we know that the `Maybe`s will be the same order in which the promises were originally passed.

## Usage

Using the `any` function is simple. Just pass the promises to it, either as a list of parameters or as an array. You can then access all the fulfilled values and the rejected errors in the `then`/`done` function.

```swift 
struct TerribleError: Error {
    let reason: String
}

let promises: [Promise<String>] = [
    Promise.value("Promise 1"), // automatically fulfilled promise
    Promise(error: TerribleError(reason: "Promise 2")), // automatically rejected promise
    Promise.value("Promise 3")
]

any(promises).done { result in
    let successCount = result.filter({ $0.isSuccess }).count
    let errorCount = result.filter({ $0.isError }).count
    print("Finished with \(successCount) successes and \(errorCount) errors.")
}.catch { _ in
    print("All the promises failed! (This shouldn't happen here)")
}
```

---

Thanks for reading! I was motivated to create this extension when I needed this functionality for SuperHomework’s new backend blog parser, so it can download all of the blog information at once in a clean manner, without having to worry about stopping the whole chain if there’s an error in a single post. If you’d like to learn more about SuperHomework, visit its website [here](https://superhomeworkapp.com/). Happy holidays!
