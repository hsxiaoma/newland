$.define("mongodb","mongodb", function(mongodb){
    var config = $.config.session;
    var server = new mongodb.Server(config.host, config.port, {});
    var Store = function(sid, life, flow){
        this.sid = sid;
        this.life = life;
        var that = this;
        if(! $.dbs[ config.db ]){
            $.dbs[ config.db ] = 1;//临时处理
            //新建或打开目标数据库
            new mongodb.Db(config.db, server, {}).open(function (e, db) {
                //新建或打开目标集合
                $.dbs[ config.db ] = db;//正式处理
                db.collection(config.table,function(e, session){
                    that.data = session
                    session.find({
                        sid: sid
                    }).toArray(function(e, docs){
                        if(!docs.length){//如果指定sessionID不存在,随机生成一个新的
                            that.sid = flow.uuid();
                        }
                        flow.fire("open_session_"+flow.id, that);
                    })
                })
            });
        }else{
            console.log("已经连接到数据库了,那么直接打开文档集合")
            $.dbs[ config.db ].collection(config.table,function(e, session){
                that.data = session
                session.find({
                    sid: sid
                }).toArray(function(e, docs){
                    if(!docs.length){//如果指定sessionID不存在,随机生成一个新的
                        that.sid = flow.uuid();
                    }
                    flow.fire("open_session_"+flow.id, that);
                })
            })
          
        }
    }
    var options = {
        safe:true,
        "new":true,
        upsert: true
    }
    var make = function( update, callback){
        callback = callback || $.noop;
        console.log(update)
        this.data.findAndModify ({
            sid:  this.sid,
            life: this.life
        }, [], update, options,function(err, doc){
            console.log(doc)
            if(err){
                callback(err)
            }else{
                callback(err,doc)
            }
        })
    }

    Store.prototype = {
        //插入或更新数据
        set: function(key, value, callback, get){
            var set = {
                timestamp: Date.now() + this.life
            }
            if(get !== true){
                set[ key ] = value;
            }
            make.call( this, {
                $set: set
            }, callback );
        },
        //读取数据
        get: function( key, callback){
            this.set(null, null, function(err,doc){
                var fn = callback || $.noop;
                console.log([err,doc])
            // fn(doc[key])
            },true);
        },
        //移除某一数据
        remove: function ( key, callback){
            make.call(this, {
                $unset:key,
                $set:{
                    timestamp:Date.now() + this.life
                }
            }, callback );
        },
        //删掉这个文档对象
        clear: function(callback){
            callback = callback || $.noop;
            this.data.remove ({
                sid: this.sid
            },options, callback)
        }
    }
    return Store;
})
