function Enumerable(enumerator) {
    this.enumerator = function () {
        return enumerator;
    };
}

(function () {

    // projection implementations
    function identityProjection(e) {
        return e;
    }

    function indexProjection(e, i) {
        return i;
    }

    // data structures
    function Lookup(equalityComparer) {

        function LookupEnumerator(lookup) {
            var keysEnumerator = lookup.keys().enumerator();

            this.reset = function() {
                keysEnumerator.reset();
            };

            this.moveNext = function() {
                return keysEnumerator.moveNext();
            };

            this.current = function() {
                var key = keysEnumerator.current();
                
                var enumerable = lookup.get(key);
                enumerable.key = function() {
                    return key;
                };

                return enumerable;
            };
        }

        var keys = new Array();
        var hashSet = new Object();

        this.keys = function(value) {
            if (value != undefined) {
                keys = value;
            }

            return keys.asEnumerable();
        };

        this.add = function(key, value) {
            var keyHash = equalityComparer.hashCode(key);

            if (!(keyHash in hashSet)) {
                keys.push(key);
                hashSet[keyHash] = new Array();
            }

            hashSet[keyHash].push(value);
        };

        this.get = function(key) {
            var keyHash = equalityComparer.hashCode(key);

            if (keyHash in hashSet) {
                return hashSet[keyHash].asEnumerable();
            } else {
                return Enumerable.empty();
            }
        };

        this.remove = function(key) {
            var keyHash = equalityComparer.hashCode(key);

            if (keyHash in hashSet) {
                var index = keys.indexOf(key, 0);
                keys.splice(index, 1);
                delete hashSet[keyHash];

                return true;
            } else {
                return false;
            }
        };

        this.enumerator = function() {
            return new LookupEnumerator(this);
        };
    }
    
    function Dictionary(equalityComparer) {

        function DictionaryEnumerator(lookup) {
            var keysEnumerator = lookup.keys().enumerator();

            this.reset = function() {
                keysEnumerator.reset();
            };

            this.moveNext = function() {
                return keysEnumerator.moveNext();
            };

            this.current = function() {
                var key = keysEnumerator.current();
                var value = lookup.get(key);

                return { key: key, value: value };
            };
        }

        var keys = new Array();
        var hashSet = new Object();

        this.keys = function(value) {
            if (value != undefined) {
                keys = value;
            }

            return keys.asEnumerable();
        };

        this.add = function(key, value) {
            var keyHash = equalityComparer.hashCode(key);

            if (keyHash in hashSet) {
                throw new Error('The key is already defined in the dictionary');
            }

            hashSet[keyHash] = value;
        };

        this.get = function(key) {
            var keyHash = equalityComparer.hashCode(key);

            if (keyHash in hashSet) {
                return hashSet[keyHash];
            } else {
                return null;
            }
        };

        this.remove = function(key) {
            var keyHash = equalityComparer.hashCode(key);

            if (keyHash in hashSet) {
                var index = keys.indexOf(key, 0);
                keys.splice(index, 1);
                delete hashSet[keyHash];

                return true;
            } else {
                return false;
            }
        };

        this.enumerator = function() {
            return new DictionaryEnumerator(this);
        };
    }

    // equality comparer
    function DefaultEqualityComparer() {

        function calculateHash(s) {
            var hash = 0;

            if (s.length == 0) {
                return hash;
            }

            for (var i = 0; i < s.length; i++) {

                var c = s.charCodeAt(i);

                hash = ((hash << 5) - hash) + c;
                hash = hash & hash;
            }

            return Math.abs(hash);
        }

        this.equal = function (x, y) {
            return this.hashCode(x) == this.hashCode(y);
        };

        this.hashCode = function (x) {
            if (x == undefined || x == null) {
                x = '';
            }

            var s = JSON.stringify(x) + JSON.stringify(x.constructor) + JSON.stringify(x.prototype);

            return calculateHash(s);
        };
    }

    // comparer implementatiorderons
    function DefaultComparer() {
        this.compare = function (x, y) {
            if (x > y) return 1;
            if (x < y) return -1;
            return 0;
        };
    }

    function ProjectionComparer(projection, comparer) {
        this.compare = function (x, y) {
            return comparer.compare(projection(x), projection(y));
        };
    }

    function ReverseComparer(forwardComparer) {
        this.compare = function (x, y) {
            return forwardComparer.compare(y, x);
        };
    }

    function CompoundComparer(primaryComparer, secondaryComparer) {
        this.compare = function (x, y) {
            var primaryResult = primaryComparer.compare(x, y);

            if (primaryResult != 0) {
                return primaryResult;
            }

            return secondaryComparer.compare(x, y);
        };
    }

    // enumerator implementations
    function EmptyEnumerator() {
        this.reset = function () {

        };

        this.moveNext = function () {
            return false;
        };

        this.current = function () {
            throw new Error();
        };
    }

    EmptyEnumerator.instance = new EmptyEnumerator();

    function RangeEnumerator(start, count) {
        var i = -1;

        if (count < 0) {
            throw new RangeError();
        }

        if (start + count - 1 > Number.MAX_VALUE) {
            throw new RangeError();
        }

        this.reset = function () {
            i = -1;
        };

        this.moveNext = function () {
            i++;

            if (i < count) {
                return true;
            }

            return false;
        };

        this.current = function () {
            return start + i;
        };
    }

    function RepeatEnumerator(element, count) {
        var i = -1;

        if (count < 0) {
            throw new RangeError();
        }

        this.reset = function () {
            i = -1;
        };

        this.moveNext = function () {
            i++;

            if (i < count) {
                return true;
            }

            return false;
        };

        this.current = function () {
            return element;
        };
    }

    function ArrayEnumerator(a) {
        var array = a;
        var currentIndex = -1;

        this.reset = function () {
            currentIndex = -1;
        };

        this.moveNext = function () {
            currentIndex++;

            return (currentIndex < array.length);
        };

        this.current = function () {
            return array[currentIndex];
        };
    }

    function ConcatenationEnumerator(first, second) {

        if (first == undefined || first == null) {
            throw new Error();
        }

        if (second == undefined || second == null) {
            throw new Error();
        }

        var firstEnumerator = first.enumerator();
        var secondEnumerator = second.enumerator();

        var current = null;

        this.reset = function () {
            firstEnumerator.reset();
            secondEnumerator.reset();
        };

        this.moveNext = function () {
            if (firstEnumerator.moveNext()) {
                current = firstEnumerator.current();
                return true;
            }

            if (secondEnumerator.moveNext()) {
                current = secondEnumerator.current();
                return true;
            }

            return false;
        };

        this.current = function () {
            return current;
        };
    }

    function IntersectEnumerator(first, second, equalityComparer) {
        if (first == undefined || first == null) {
            throw new Error('first is not defined');
        }

        if (second == undefined || second == null) {
            throw new Error('second is not defined');
        }

        if (equalityComparer == undefined || equalityComparer == null) {
            throw new Error('equalityComparer is not defined');
        }

        var enumerator = first.enumerator();

        var hashSet = new Object();

        second.foreach(function (e) {
            hashSet[equalityComparer.hashCode(e)] = true;
        });

        this.reset = function () {
            enumerator.reset();
        };

        this.moveNext = function () {
            var hash;

            do {
                if (!enumerator.moveNext()) {
                    return false;
                }

                hash = equalityComparer.hashCode(enumerator.current());
            } while (!(hash in hashSet));

            delete hashSet[hash];
            return true;
        };

        this.current = function () {
            return enumerator.current();
        };
    }

    function ExceptEnumerator(first, second, equalityComparer) {
        if (first == undefined || first == null) {
            throw new Error('first is not defined');
        }

        if (second == undefined || second == null) {
            throw new Error('second is not defined');
        }

        if (equalityComparer == undefined || equalityComparer == null) {
            throw new Error('equalityComparer is not defined');
        }

        var enumerator = first.enumerator();

        var hashSet = new Object();

        second.foreach(function (e) {
            hashSet[equalityComparer.hashCode(e)] = true;
        });

        this.reset = function () {
            enumerator.reset();
        };

        this.moveNext = function () {
            var hash;

            do {
                if (!enumerator.moveNext()) {
                    return false;
                }

                hash = equalityComparer.hashCode(enumerator.current());
            } while (hash in hashSet);

            delete hashSet[hash];
            return true;
        };

        this.current = function () {
            return enumerator.current();
        };
    }

    function PredicateEnumerator(enumerable, predicate) {
        var enumerator = enumerable.enumerator();
        var currentIndex = -1;

        this.reset = function () {
            enumerator.reset();
            currentIndex = -1;
        };

        this.moveNext = function () {
            var mn;

            do {
                currentIndex++;
                mn = enumerator.moveNext();
            } while (mn && !predicate(enumerator.current(), currentIndex))

            return mn;
        };

        this.current = function () {
            return enumerator.current();
        };
    }

    function ProjectionEnumerator(enumerable, projection) {
        var enumerator = enumerable.enumerator();
        var currentIndex = -1;

        this.reset = function () {
            enumerator.reset();
            currentIndex = -1;
        };

        this.moveNext = function () {
            currentIndex++;
            return enumerator.moveNext();
        };

        this.current = function () {
            return projection(enumerator.current(), currentIndex);
        };
    }

    function EnumerableProjectionEnumerator(enumerable, projection, resultProjection) {
        if (enumerable == undefined || enumerable == null) {
            throw new Error();
        }

        if (projection == undefined || projection == null) {
            throw new Error();
        }

        if (resultProjection == undefined || resultProjection == null) {
            resultProjection = function (sourceItem, projectedItem) {
                return projectedItem;
            };
        }

        var sourceEnumerator = enumerable.enumerator();
        var projectionEnumerable = null;
        var projectionEnumerator = null;

        var source = null;
        var current = null;

        var index = 0;

        this.reset = function () {
            current = null;
            projectionEnumerable = null;
            projectionEnumerator = null;

            index = 0;

            sourceEnumerator.reset();
        };

        this.moveNext = function () {
            if (projectionEnumerator == null || !projectionEnumerator.moveNext()) {
                if (sourceEnumerator.moveNext()) {
                    source = sourceEnumerator.current();

                    projectionEnumerable = projection(source, index++);
                    projectionEnumerator = projectionEnumerable.enumerator();

                } else {
                    return false;
                }
            }

            current = projectionEnumerator.current();

            return true;
        };

        this.current = function () {
            return resultProjection(source, current);
        };
    }

    function OrderedEnumerator(enumerable, comparer) {
        var currentElement = null;

        var elements = null;

        this.reset = function () {
            elements = enumerable.toArray();
        };

        this.moveNext = function () {

            if (elements.length > 0) {
                currentElement = elements[0];
                var minIndex = 0;

                for (var i = 1; i < elements.length; i++) {
                    if (comparer.compare(elements[i], currentElement) < 0) {
                        currentElement = elements[i];
                        minIndex = i;
                    }
                }

                elements.splice(minIndex, 1);
                return true;

            } else {
                return false;
            }
        };

        this.current = function () {
            return currentElement;
        };
    }

    function DistinctEnumerator(enumerable, equalityComparer) {
        if (enumerable == undefined || enumerable == null) {
            throw new Error('enumerable is not defined');
        }

        if (equalityComparer == undefined || equalityComparer == null) {
            throw new Error('equalityComparer is not defined');
        }

        var hashSet = new Object();
        var enumerator = enumerable.enumerator();

        this.reset = function () {
            enumerator.reset();
        };

        this.moveNext = function () {
            var hash;

            do {
                if (!enumerator.moveNext()) {
                    return false;
                }

                hash = equalityComparer.hashCode(enumerator.current());
            } while (hash in hashSet);

            hashSet[hash] = new Object();

            return true;
        };

        this.current = function () {
            return enumerator.current();
        };
    }

    function JoinEnumerator(outer, inner, outerKeyProjection, innerKeyProjection, resultProjection, equalityComparer) {
        
        var lookup = inner.toLookup(innerKeyProjection, identityProjection, equalityComparer);

        var outerEnumerator = outer.enumerator();
        var innerEnumerator = null;

        this.reset = function () {
            outerEnumerator.reset();
            innerEnumerator = null;
        };

        this.moveNext = function () {

            while (innerEnumerator == null || !innerEnumerator.moveNext()) { 
                if (outerEnumerator.moveNext()) {
                    var key = outerKeyProjection(outerEnumerator.current());

                    innerEnumerator = lookup.get(key).enumerator();

                    innerEnumerator.reset();
                } else {
                    return false;
                }
            }

            return true;
        };

        this.current = function () {
            return resultProjection(outerEnumerator.current(), innerEnumerator.current());
        };
    }

    function ZipEnumerator(first, second, resultProjection) {
        var enumerator = first.enumerator();
        var secondEnumerator = second.enumerator();

        this.reset = function () {
            enumerator.reset();
            secondEnumerator.reset();
        };

        this.moveNext = function () {
            return enumerator.moveNext() && secondEnumerator.moveNext();
        };

        this.current = function () {
            return resultProjection(enumerator.current(), secondEnumerator.current());
        };
    }

    function GroupJoinEnumerator(outer, inner, outerKeyProjection, innerKeyProjection, resultProjection, equalityComparer) {
        
        var lookup = inner.toLookup(innerKeyProjection, identityProjection, equalityComparer);

        var outerEnumerator = outer.enumerator();

        this.reset = function () {
            outerEnumerator.reset();
        };

        this.moveNext = function () {
            return outerEnumerator.moveNext();
        };

        this.current = function () {
            var current = outerEnumerator.current();

            return resultProjection(current, lookup.get(outerKeyProjection(current)));
        };
    }

    function TakeWhileEnumerator(enumerable, predicate) {
        var enumerator = enumerable.enumerator();

        this.reset = function () {
            enumerator.reset();
        };

        this.moveNext = function () {
            return enumerator.moveNext() && predicate(enumerator.current());
        };

        this.current = function () {
            return enumerator.current();
        };
    }

    function SkipWhileEnumerator(enumerable, predicate) {
        var enumerator = enumerable.enumerator();

        this.reset = function () {
            enumerator.reset();
        };

        this.moveNext = function () {
            return enumerator.moveNext() && !predicate(enumerator.current());
        };

        this.current = function () {
            return enumerator.current();
        };
    }

    // enumerable implemenations
    function extendEnumerable(constructor) {
        constructor.prototype.foreach = function (f) {
            var enumerator = this.enumerator();

            enumerator.reset();

            while (enumerator.moveNext()) {
                f(enumerator.current());
            }
        };

        constructor.prototype.where = function (predicate) {
            return new Enumerable(new PredicateEnumerator(this, predicate));
        };

        constructor.prototype.count = function () {
            var count = 0;

            var enumerator = this.enumerator();
            enumerator.reset();

            while (enumerator.moveNext()) {
                count++;
            }

            return count;
        };

        constructor.prototype.concat = function (enumerable) {
            return new Enumerable(new ConcatenationEnumerator(this, enumerable));
        };

        constructor.prototype.select = function (projection) {
            return new Enumerable(new ProjectionEnumerator(this, projection));
        };

        constructor.prototype.selectMany = function (projection, resultingProjection) {
            return new Enumerable(new EnumerableProjectionEnumerator(this, projection, resultingProjection));
        };

        constructor.prototype.aggregate = function (accumulator, projection, seed) {

            if (accumulator == undefined || accumulator == null) {
                throw new Error('accumulator is not defined');
            }

            if (projection == undefined || projection == null) {
                projection = identityProjection;
            }

            var current = null;

            if (seed != undefined && seed != null) {

                current = seed;

                this.foreach(function (e) {
                    current = accumulator(current, e);
                });

            } else {

                var enumerator = this.enumerator();

                enumerator.reset();

                if (enumerator.moveNext()) {
                    current = enumerator.current();
                }

                while (enumerator.moveNext()) {
                    current = accumulator(current, enumerator.current());
                }
            }

            return projection(current);
        };

        constructor.prototype.distinct = function (equalityComparer) {
            if (equalityComparer == undefined || equalityComparer == null) {
                equalityComparer = new DefaultEqualityComparer();
            }

            return new Enumerable(new DistinctEnumerator(this, equalityComparer));
        };

        constructor.prototype.firstOrDefault = function (predicate) {
            if (predicate == undefined || predicate == null) {
                predicate = function () { return true; };
            }

            var enumerable = this.where(predicate);

            var enumerator = enumerable.enumerator();

            enumerator.reset();
            if (enumerator.moveNext()) {
                return enumerator.current();
            } else {
                return null;
            }
        };

        constructor.prototype.first = function (predicate) {
            var result = this.firstOrDefault(predicate);

            if (result == null) {
                throw new Error('Sequence contains no elements.');
            }

            return result;
        };

        constructor.prototype.lastOrDefault = function (predicate) {
            if (predicate == undefined || predicate == null) {
                predicate = function () { return true; };
            }

            var enumerable = this.where(predicate);

            var result = null;

            enumerable.foreach(function (element) {
                result = element;
            });

            return result;
        };

        constructor.prototype.last = function (predicate) {
            var result = this.lastOrDefault(predicate);

            if (result == null) {
                throw new Error('Sequence contains no elements.');
            }

            return result;
        };

        constructor.prototype.singleOrDefault = function (predicate) {
            if (predicate == undefined || predicate == null) {
                predicate = function () { return true; };
            }

            var enumerable = this.where(predicate);

            var enumerator = enumerable.enumerator();

            var result;

            enumerator.reset();

            if (enumerator.moveNext()) {
                result = enumerator.current();
            } else {
                return null;
            }

            if (enumerator.moveNext()) {
                return null;
            }

            return result;
        };

        constructor.prototype.single = function (predicate) {
            if (predicate == undefined || predicate == null) {
                predicate = function () { return true; };
            }

            var enumerable = this.where(predicate);

            var enumerator = enumerable.enumerator();

            var result;

            enumerator.reset();

            if (enumerator.moveNext()) {
                result = enumerator.current();
            } else {
                throw new Error('Sequence contains no elements');
            }

            if (enumerator.moveNext()) {
                throw new Error('Sequence contains multiple matching elements');
            }

            return result;
        };

        constructor.prototype.any = function (predicate) {
            if (predicate == undefined || predicate == null) {
                predicate = function () { return true; };
            }

            var match = this.firstOrDefault(predicate);

            return match != null;
        };

        constructor.prototype.all = function (predicate) {
            if (predicate == undefined || predicate == null) {
                throw new Error();
            }

            return !this.any(function (element) {
                return !(predicate(element));
            });
        };

        constructor.prototype.take = function (amount) {
            var predicate = function (e, i) { return i < amount; };

            return this.where(predicate);
        };

        constructor.prototype.takeWhile = function (predicate) {
            if (predicate == undefined || predicate == null) {
                throw new Error('predicate is not defined');
            }

            return new Enumerable(new TakeWhileEnumerator(this, predicate));
        };

        constructor.prototype.skip = function (amount) {
            var predicate = function (e, i) { return i >= amount; };
            
            return this.where(predicate);
        };

        constructor.prototype.skipWhile = function (predicate) {
            if (predicate == undefined || predicate == null) {
                throw new Error('predicate is not defined');
            }
            
            return new Enumerable(new SkipWhileEnumerator(this, predicate));
        };

        constructor.prototype.orderBy = function (projection, comparer) {
            var p = identityProjection;
            var c = new DefaultComparer();

            if (projection != undefined && projection != null) {
                p = projection;
            }

            if (comparer != undefined && comparer != null) {
                c = comparer;
            }

            var projectionComparer = new ProjectionComparer(p, c);

            return new OrderedEnumerable(this, projectionComparer);
        };

        constructor.prototype.orderByDescending = function (projection, comparer) {
            var p = identityProjection;
            var c = new DefaultComparer();

            if (projection != undefined && projection != null) {
                p = projection;
            }

            if (comparer != undefined && comparer != null) {
                c = comparer;
            }

            var projectionComparer = new ReverseComparer(new ProjectionComparer(p, c));

            return new OrderedEnumerable(this, projectionComparer);
        };

        constructor.prototype.reverse = function () {
            return this.orderByDescending(indexProjection, new DefaultComparer());
        };

        constructor.prototype.union = function (enumerable, equalityComparer) {
            if (equalityComparer == undefined || equalityComparer == null) {
                equalityComparer = new DefaultEqualityComparer();
            }

            return this.concat(enumerable).distinct(equalityComparer);
        };

        constructor.prototype.intersect = function (enumerable, equalityComparer) {
            if (equalityComparer == undefined || equalityComparer == null) {
                equalityComparer = new DefaultEqualityComparer();
            }

            return new Enumerable(new IntersectEnumerator(this, enumerable, equalityComparer));
        };

        constructor.prototype.except = function (enumerable, equalityComparer) {
            if (equalityComparer == undefined || equalityComparer == null) {
                equalityComparer = new DefaultEqualityComparer();
            }

            return new Enumerable(new ExceptEnumerator(this, enumerable, equalityComparer));
        };

        constructor.prototype.toLookup = function(keyProjection, elementProjection, equalityComparer) {
            if (keyProjection == undefined || keyProjection == null) {
                throw new Error('keyProjection is not defined');
            }

            if (elementProjection == undefined || elementProjection == null) {
                elementProjection = identityProjection;
            }

            if (equalityComparer == undefined || equalityComparer == null) {
                equalityComparer = new DefaultEqualityComparer();
            }

            var lookup = new Lookup(equalityComparer);

            this.foreach(function(e) {
                var key = keyProjection(e);
                var element = elementProjection(e);

                lookup.add(key, element);
            });

            return lookup;
        };

        constructor.prototype.toDictionary = function(keyProjection, elementProjection, equalityComparer) {
            if (keyProjection == undefined || keyProjection == null) {
                throw new Error('keyProjection is not defined');
            }

            if (elementProjection == undefined || elementProjection == null) {
                elementProjection = identityProjection;
            }

            if (equalityComparer == undefined || equalityComparer == null) {
                equalityComparer = new DefaultEqualityComparer();
            }

            var dictionary = new Dictionary(equalityComparer);

            this.foreach(function(e) {
                var key = keyProjection(e);
                var element = elementProjection(e);

                dictionary.add(key, element);
            });

            return dictionary;
        };

        constructor.prototype.groupBy = function(keyProjection, elementProjection, equalityComparer) {
            if (keyProjection == undefined || keyProjection == null) {
                throw new Error('keyProjection is not defined');
            }

            if (elementProjection == undefined || elementProjection == null) {
                elementProjection = identityProjection;
            }

            if (equalityComparer == undefined || equalityComparer == null) {
                equalityComparer = new DefaultEqualityComparer();
            }

            return this.toLookup(keyProjection, elementProjection, equalityComparer);
        };

        constructor.prototype.join = function(inner, outerKeyProjection, innerKeyProjection, resultProjection, equalityComparer) {
            
            if (inner == undefined || inner == null) {
                throw new Error('inner is not defined');
            }

            if (outerKeyProjection == undefined || outerKeyProjection == null) {
                throw new Error('outerKeyProjection is not defined');
            }

            if (innerKeyProjection == undefined || innerKeyProjection == null) {
                throw new Error('innerKeyProjection is not defined');
            }

            if (resultProjection == undefined || resultProjection == null) {
                resultProjection = identityProjection;
            }

            if (equalityComparer == undefined || equalityComparer == null) {
                equalityComparer = new DefaultEqualityComparer();
            }

            return new Enumerable(new JoinEnumerator(this, inner, outerKeyProjection, innerKeyProjection, resultProjection, equalityComparer));
        };

        constructor.prototype.groupJoin = function(inner, outerKeyProjection, innerKeyProjection, resultProjection, equalityComparer) {
            
            if (inner == undefined || inner == null) {
                throw new Error('inner is not defined');
            }

            if (outerKeyProjection == undefined || outerKeyProjection == null) {
                throw new Error('outerKeyProjection is not defined');
            }

            if (innerKeyProjection == undefined || innerKeyProjection == null) {
                throw new Error('innerKeyProjection is not defined');
            }

            if (resultProjection == undefined || resultProjection == null) {
                resultProjection = identityProjection;
            }

            if (equalityComparer == undefined || equalityComparer == null) {
                equalityComparer = new DefaultEqualityComparer();
            }

            return new Enumerable(new GroupJoinEnumerator(this, inner, outerKeyProjection, innerKeyProjection, resultProjection, equalityComparer));
        };

        constructor.prototype.contains = function(element, equalityComparer) {
            if (equalityComparer == undefined || equalityComparer == null) {
                equalityComparer = new DefaultEqualityComparer();
            }

            var match = this.firstOrDefault(function(e) {
                return equalityComparer.equal(element, e);
            });

            return match != null;
        };

        constructor.prototype.sequenceEqual = function(second, equalityComparer) {
            if (second == undefined || second == null) {
                throw new Error('second is not defined');
            }

            if (equalityComparer == undefined || equalityComparer == null) {
                equalityComparer = new DefaultEqualityComparer();
            }

            var enumerator = this.enumerator();
            var secondEnumerator = second.enumerator();

            enumerator.reset();
            secondEnumerator.reset();

            while (enumerator.moveNext()) {
                if (!secondEnumerator.moveNext()) {
                    return false;
                }
                
                if (!equalityComparer.equal(enumerator.current(), secondEnumerator.current())) {
                    return false;
                }
            }

            return !secondEnumerator.moveNext();
        };

        constructor.prototype.zip = function(second, resultProjection) {
            if (second == undefined || second == null) {
                throw new Error('second is not defined');
            }

            if (resultProjection == undefined || resultProjection == null) {
                throw new Error('resultProjection is not defined');
            }

            return new Enumerable(new ZipEnumerator(this, second, resultProjection));
        };
    }

    function extendToArray(constructor) {

        constructor.prototype.toArray = function () {
            var enumerator = this.enumerator();

            enumerator.reset();

            var resultArray = new Array();

            while (enumerator.moveNext()) {
                resultArray.push(enumerator.current());
            }

            return resultArray;
        };
    }

    function extendOrderedEnumerable(constructor) {
        constructor.prototype.thenBy = function (projection, comparer) {
            if (comparer == undefined || comparer == null) {
                comparer = new DefaultComparer();
            }

            var primaryComparer = this.comparer();
            var projectionComparer = new ProjectionComparer(projection, comparer);

            this.comparer(new CompoundComparer(primaryComparer, projectionComparer));

            return this;
        };
    }

    Enumerable.empty = function () {
        return new Enumerable(EmptyEnumerator.instance);
    };

    Enumerable.range = function (start, count) {
        return new Enumerable(new RangeEnumerator(start, count));
    };

    Enumerable.repeat = function (element, count) {
        return new Enumerable(new RepeatEnumerator(element, count));
    };


    function OrderedEnumerable(enumerable, comparer) {
        var c = comparer;

        this.comparer = function (value) {
            if (value != undefined && value != null) {
                c = value;
            }

            return c;
        };

        this.enumerator = function () {
            return new OrderedEnumerator(enumerable, c);
        };
    }
    
    // array extensions
    Array.prototype.enumerator = function() {
        return new ArrayEnumerator(this);
    };
    
    Array.prototype.asEnumerable = function () {
        return new Enumerable(new ArrayEnumerator(this));
    };
    
    extendEnumerable(Enumerable);
    extendEnumerable(OrderedEnumerable);
    extendEnumerable(Lookup);
    extendEnumerable(Dictionary);
    
    extendToArray(Enumerable);
    extendToArray(OrderedEnumerable);
    extendToArray(Lookup);
    extendToArray(Dictionary);
    
    extendOrderedEnumerable(OrderedEnumerable);
})();